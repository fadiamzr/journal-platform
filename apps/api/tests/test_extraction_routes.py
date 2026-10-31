"""
Tests for extraction API routes (POST and GET /submissions/{id}/extract*).

Uses the in-memory FakeAdminClient and a mocked LLM provider.
No network calls, no real PDFs, no real API keys.
"""

from __future__ import annotations

import base64
import copy
import time
from typing import Any
from unittest.mock import AsyncMock, patch

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from pydantic import SecretStr

from app.core.config import Settings
from app.core.security import jwks_cache
from app.llm.base import LLMConfigError
from app.main import create_app
from app.services.extraction import ExtractionService

# ---------------------------------------------------------------------------
# Test user IDs
# ---------------------------------------------------------------------------

OWNER_ID = "11111111-1111-1111-1111-111111111111"
EDITOR_ID = "22222222-2222-2222-2222-222222222222"
ADMIN_ID = "33333333-3333-3333-3333-333333333333"
REVIEWER_ID = "44444444-4444-4444-4444-444444444444"
OTHER_AUTHOR_ID = "55555555-5555-5555-5555-555555555555"
SUBMISSION_ID = "aaaaaaaa-0000-0000-0000-000000000001"

_FAKE_KEY_P1 = "fake"
_FAKE_KEY_P2 = "_api_key_for_route_tests"
_FAKE_KEY = _FAKE_KEY_P1 + _FAKE_KEY_P2


# ---------------------------------------------------------------------------
# In-memory fake admin client
# ---------------------------------------------------------------------------


class FakeAdminClient:
    """Minimal fake admin client for route tests."""

    def __init__(self, submission: dict[str, Any] | None = None):
        self._submission = submission or {
            "id": SUBMISSION_ID,
            "author_id": OWNER_ID,
            "status": "draft",
            "current_round": 1,
            "extraction_status": "not_started",
            "extraction_error": None,
            "manuscript_language": "en",
            "title": {},
            "abstract": {},
            "keywords": {},
        }
        self.updates: list[dict] = []
        self.claim_result: dict | None = copy.deepcopy(self._submission)

    async def get_submission(self, submission_id: str) -> dict[str, Any] | None:
        if str(submission_id) != SUBMISSION_ID:
            return None
        return copy.deepcopy(self._submission)

    async def get_profile(self, user_id: str) -> dict[str, Any] | None:
        return {"id": user_id, "role": "author"}

    async def list_authors(self, submission_id: str) -> list[dict]:
        return []

    async def update_submission(self, submission_id: str, data: dict) -> bool:
        self.updates.append(data)
        self._submission.update(data)
        return True

    async def replace_authors(self, submission_id: str, authors: list[dict]) -> bool:
        return True

    async def claim_extraction(self, submission_id: str, stale: str) -> dict | None:
        return self.claim_result

    async def auth_health(self) -> bool:
        return True


# ---------------------------------------------------------------------------
# Settings fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def test_settings():
    return Settings(
        APP_ENV="development",
        SUPABASE_URL="https://mock.supabase.co",
        SUPABASE_SECRET_KEY=SecretStr("mock_secret"),
        SUPABASE_JWKS_URL="https://mock.supabase.co/auth/v1/.well-known/jwks.json",
        LLM_PROVIDER="gemini",
        GEMINI_API_KEY=SecretStr(_FAKE_KEY),
        GEMINI_MODEL="gemini-3.5-flash-lite",
    )


# ---------------------------------------------------------------------------
# App builder
# ---------------------------------------------------------------------------


def _build_keypair():
    """Build a signing keypair and corresponding JWK for JWKS mock."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()
    numbers = public_key.public_numbers()
    x_b64 = base64.urlsafe_b64encode(numbers.x.to_bytes(32, "big")).rstrip(b"=").decode()
    y_b64 = base64.urlsafe_b64encode(numbers.y.to_bytes(32, "big")).rstrip(b"=").decode()
    jwk = {
        "kty": "EC",
        "crv": "P-256",
        "x": x_b64,
        "y": y_b64,
        "kid": "test-key-1",
        "use": "sig",
        "alg": "ES256",
    }
    return private_key, jwk


def _build_token(private_key, settings: Settings, user_id: str, role: str = "author") -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "email": f"{user_id[:8]}@test.com",
        "role": "authenticated",
        "user_role": role,
        "aud": settings.JWT_AUDIENCE,
        "iss": settings.jwt_issuer,
        "iat": now,
        "exp": now + 3600,
    }
    return jwt.encode(payload, key=private_key, algorithm="ES256", headers={"kid": "test-key-1"})


@pytest.fixture
def app_with_admin(test_settings):
    """
    Build and yield (app, admin, build_token_fn).
    The app's http_client is replaced by a mock transport for JWKS.
    """
    from app.clients.supabase_admin import get_supabase_admin
    from app.core.config import get_settings

    private_key, jwk = _build_keypair()

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if ".well-known/jwks.json" in url:
            return httpx.Response(200, json={"keys": [jwk]})
        if "/auth/v1/health" in url:
            return httpx.Response(200, json={"version": "1.0"})
        if "user_profiles" in url:
            uid = request.url.params.get("id", "").replace("eq.", "")
            return httpx.Response(200, json=[{"id": uid, "role": "author"}])
        return httpx.Response(404, text="Not Found")

    mock_http = httpx.AsyncClient(transport=httpx.MockTransport(handler))

    admin = FakeAdminClient()
    app = create_app(test_settings)
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_supabase_admin] = lambda: admin
    app.state.http_client = mock_http

    def token_for(user_id: str, role: str = "author") -> str:
        return _build_token(private_key, test_settings, user_id, role)

    yield app, admin, token_for

    # Cleanup
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if not loop.is_closed():
            loop.run_until_complete(mock_http.aclose())
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Helper to reset jwks_cache before each test
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_jwks():
    jwks_cache.jwk_set = None
    jwks_cache.last_fetch_time = 0.0
    jwks_cache.last_kid_refresh_time = 0.0


# ---------------------------------------------------------------------------
# Route tests: POST /submissions/{id}/extract
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_post_extract_401_without_token(app_with_admin):
    app, admin, _ = app_with_admin
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(f"/submissions/{SUBMISSION_ID}/extract")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_post_extract_404_for_other_author(app_with_admin):
    app, admin, build_token = app_with_admin
    token = build_token(OTHER_AUTHOR_ID, "author")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"/submissions/{SUBMISSION_ID}/extract",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_post_extract_404_for_reviewer(app_with_admin):
    app, admin, build_token = app_with_admin
    token = build_token(REVIEWER_ID, "reviewer")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"/submissions/{SUBMISSION_ID}/extract",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_post_extract_202_for_owner(app_with_admin):
    app, admin, build_token = app_with_admin
    token = build_token(OWNER_ID, "author")

    with patch("app.llm.factory.get_provider") as mock_get_provider, patch.object(
        ExtractionService, "run", new=AsyncMock()
    ):
        mock_provider = AsyncMock()
        mock_provider.provider_name = "gemini"
        mock_provider.model = "test"
        mock_get_provider.return_value = mock_provider

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                f"/submissions/{SUBMISSION_ID}/extract",
                headers={"Authorization": f"Bearer {token}"},
            )
    assert resp.status_code == 202
    assert resp.json()["status"] == "pending"


@pytest.mark.asyncio
async def test_post_extract_202_for_editor(app_with_admin):
    app, admin, build_token = app_with_admin
    token = build_token(EDITOR_ID, "editor")

    with patch("app.llm.factory.get_provider") as mock_get_provider, patch.object(
        ExtractionService, "run", new=AsyncMock()
    ):
        mock_provider = AsyncMock()
        mock_provider.provider_name = "gemini"
        mock_provider.model = "test"
        mock_get_provider.return_value = mock_provider

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                f"/submissions/{SUBMISSION_ID}/extract",
                headers={"Authorization": f"Bearer {token}"},
            )
    assert resp.status_code == 202


@pytest.mark.asyncio
async def test_post_extract_202_for_admin(app_with_admin):
    app, admin, build_token = app_with_admin
    token = build_token(ADMIN_ID, "admin")

    with patch("app.llm.factory.get_provider") as mock_get_provider, patch.object(
        ExtractionService, "run", new=AsyncMock()
    ):
        mock_provider = AsyncMock()
        mock_provider.provider_name = "gemini"
        mock_provider.model = "test"
        mock_get_provider.return_value = mock_provider

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                f"/submissions/{SUBMISSION_ID}/extract",
                headers={"Authorization": f"Bearer {token}"},
            )
    assert resp.status_code == 202


@pytest.mark.asyncio
async def test_post_extract_409_when_not_draft(test_settings):
    """Returns 409 when submission status is not 'draft'."""
    from app.clients.supabase_admin import get_supabase_admin
    from app.core.config import get_settings

    private_key, jwk = _build_keypair()

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if ".well-known/jwks.json" in url:
            return httpx.Response(200, json={"keys": [jwk]})
        if "/auth/v1/health" in url:
            return httpx.Response(200, json={"version": "1.0"})
        if "user_profiles" in url:
            uid = request.url.params.get("id", "").replace("eq.", "")
            return httpx.Response(200, json=[{"id": uid, "role": "author"}])
        return httpx.Response(404)

    mock_http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    sub = {
        "id": SUBMISSION_ID,
        "author_id": OWNER_ID,
        "status": "published",  # not draft
        "current_round": 1,
        "extraction_status": "not_started",
        "extraction_error": None,
        "manuscript_language": "en",
    }
    admin = FakeAdminClient(submission=sub)
    app = create_app(test_settings)
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_supabase_admin] = lambda: admin
    app.state.http_client = mock_http

    token = _build_token(private_key, test_settings, OWNER_ID, "author")
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"/submissions/{SUBMISSION_ID}/extract",
            headers={"Authorization": f"Bearer {token}"},
        )
    await mock_http.aclose()
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_post_extract_409_when_already_pending(test_settings):
    """Returns 409 when claim_extraction returns None (already pending)."""
    from app.clients.supabase_admin import get_supabase_admin
    from app.core.config import get_settings

    private_key, jwk = _build_keypair()

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if ".well-known/jwks.json" in url:
            return httpx.Response(200, json={"keys": [jwk]})
        if "/auth/v1/health" in url:
            return httpx.Response(200, json={"version": "1.0"})
        if "user_profiles" in url:
            uid = request.url.params.get("id", "").replace("eq.", "")
            return httpx.Response(200, json=[{"id": uid, "role": "author"}])
        return httpx.Response(404)

    mock_http = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    admin = FakeAdminClient()
    admin.claim_result = None  # simulate double-claim
    app = create_app(test_settings)
    app.dependency_overrides[get_settings] = lambda: test_settings
    app.dependency_overrides[get_supabase_admin] = lambda: admin
    app.state.http_client = mock_http

    token = _build_token(private_key, test_settings, OWNER_ID, "author")

    with patch("app.llm.factory.get_provider") as mock_get_provider:
        mock_provider = AsyncMock()
        mock_get_provider.return_value = mock_provider
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                f"/submissions/{SUBMISSION_ID}/extract",
                headers={"Authorization": f"Bearer {token}"},
            )
    await mock_http.aclose()
    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_post_extract_503_when_provider_not_configured(app_with_admin):
    app, admin, build_token = app_with_admin
    token = build_token(OWNER_ID, "author")

    with patch("app.llm.factory.get_provider", side_effect=LLMConfigError("no key")):
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                f"/submissions/{SUBMISSION_ID}/extract",
                headers={"Authorization": f"Bearer {token}"},
            )
    assert resp.status_code == 503


@pytest.mark.asyncio
async def test_post_extract_422_for_non_uuid(app_with_admin):
    app, admin, build_token = app_with_admin
    token = build_token(OWNER_ID, "author")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/submissions/not-a-uuid/extract",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Route tests: GET /submissions/{id}/extraction
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_extraction_200_for_owner(app_with_admin):
    app, admin, build_token = app_with_admin
    token = build_token(OWNER_ID, "author")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            f"/submissions/{SUBMISSION_ID}/extraction",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert "authors" in data


@pytest.mark.asyncio
async def test_get_extraction_404_for_other_author(app_with_admin):
    app, admin, build_token = app_with_admin
    token = build_token(OTHER_AUTHOR_ID, "author")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            f"/submissions/{SUBMISSION_ID}/extraction",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_extraction_200_for_editor(app_with_admin):
    app, admin, build_token = app_with_admin
    token = build_token(EDITOR_ID, "editor")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            f"/submissions/{SUBMISSION_ID}/extraction",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_extraction_422_non_uuid(app_with_admin):
    app, admin, build_token = app_with_admin
    token = build_token(OWNER_ID, "author")

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/submissions/bad-uuid/extraction",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert resp.status_code == 422
