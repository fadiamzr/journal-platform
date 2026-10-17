"""
Shared pytest fixtures: mock key generation, JWKS mock transport, and isolated test clients.
No real .env files, no secrets, and no external network calls.
"""

from __future__ import annotations

import base64
import time
from typing import Any
from unittest.mock import patch

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from pydantic import SecretStr

from app.core.config import Settings, get_settings
from app.core.security import jwks_cache
from app.main import create_app


def ec_public_key_to_jwk(
    public_key: ec.EllipticCurvePublicKey,
    kid: str = "test-key-1",
) -> dict[str, str]:
    """Convert an ECC P-256 public key into a JWK dictionary."""
    numbers = public_key.public_numbers()
    x_bytes = numbers.x.to_bytes(32, byteorder="big")
    y_bytes = numbers.y.to_bytes(32, byteorder="big")
    x_b64 = base64.urlsafe_b64encode(x_bytes).rstrip(b"=").decode("ascii")
    y_b64 = base64.urlsafe_b64encode(y_bytes).rstrip(b"=").decode("ascii")
    return {
        "kty": "EC",
        "crv": "P-256",
        "x": x_b64,
        "y": y_b64,
        "kid": kid,
        "use": "sig",
        "alg": "ES256",
    }


@pytest.fixture(autouse=True)
def reset_jwks_cache():
    """Reset the global in-memory JWKS cache before each test."""
    jwks_cache.jwk_set = None
    jwks_cache.last_fetch_time = 0.0
    jwks_cache.last_kid_refresh_time = 0.0


@pytest.fixture
def key_pair():
    """Generate a throwaway ECC P-256 keypair for ES256 JWT signing."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()
    return private_key, public_key


@pytest.fixture
def second_key_pair():
    """Generate a second distinct throwaway keypair for invalid signature tests."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()
    return private_key, public_key


@pytest.fixture
def primary_jwk(key_pair):
    """JWK representation of the primary test public key."""
    _, public_key = key_pair
    return ec_public_key_to_jwk(public_key, kid="test-key-1")


@pytest.fixture
def test_settings():
    """Isolated test settings without reading any .env file."""
    return Settings(
        APP_ENV="development",
        LOG_LEVEL="DEBUG",
        SUPABASE_URL="https://mock.supabase.co",
        SUPABASE_SECRET_KEY=SecretStr("mock_secret_key_non_secret"),
        SUPABASE_JWKS_URL="https://mock.supabase.co/auth/v1/.well-known/jwks.json",
        JWT_AUDIENCE="authenticated",
        JWKS_CACHE_TTL_SECONDS=600,
        CORS_ORIGINS="http://localhost:3000,http://localhost:8000",
        MAX_UPLOAD_MB=50,
    )


@pytest.fixture
def mock_jwks_state(primary_jwk):
    """Mutable container tracking JWKS keys and request counts."""
    return {
        "keys": [primary_jwk],
        "fetch_count": 0,
        "auth_health_ok": True,
        "jwks_status_code": 200,
        "profiles": {},
    }


@pytest.fixture
def mock_http_client(test_settings, mock_jwks_state):
    """Mock httpx.AsyncClient servicing Supabase Auth, JWKS, and PostgREST endpoints."""
    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        # 1. JWKS endpoint
        if url == test_settings.SUPABASE_JWKS_URL:
            mock_jwks_state["fetch_count"] += 1
            if mock_jwks_state["jwks_status_code"] != 200:
                return httpx.Response(mock_jwks_state["jwks_status_code"], text="JWKS unavailable")
            return httpx.Response(200, json={"keys": mock_jwks_state["keys"]})

        # 2. Supabase Auth health endpoint
        if url == f"{test_settings.SUPABASE_URL}/auth/v1/health":
            status_code = 200 if mock_jwks_state["auth_health_ok"] else 500
            return httpx.Response(status_code, json={"version": "1.0"})

        # 3. PostgREST user_profiles endpoint
        if "rest/v1/user_profiles" in url:
            user_id = request.url.params.get("id", "").replace("eq.", "")
            profile = mock_jwks_state["profiles"].get(
                user_id,
                {
                    "id": user_id or "00000000-0000-0000-0000-000000000000",
                    "full_name": "Test User",
                    "role": "author",
                    "preferred_locale": "en",
                },
            )
            return httpx.Response(200, json=[profile] if profile else [])

        return httpx.Response(404, text="Not Found")

    transport = httpx.MockTransport(handler)
    return httpx.AsyncClient(transport=transport)


@pytest.fixture
def token_builder(key_pair, test_settings):
    """Helper factory for generating signed JWTs with customizable claims."""
    private_key, _ = key_pair

    def _build(
        sub: str = "11111111-1111-1111-1111-111111111111",
        email: str = "test@example.com",
        user_role: str | None = "author",
        aud: str | None = None,
        iss: str | None = None,
        exp_delta: int = 3600,
        kid: str = "test-key-1",
        signing_key=None,
        algorithm: str = "ES256",
        extra_claims: dict[str, Any] | None = None,
    ) -> str:
        now = int(time.time())
        payload = {
            "sub": sub,
            "email": email,
            "role": "authenticated",  # PostgREST role stays authenticated
            "user_role": user_role,
            "aud": aud if aud is not None else test_settings.JWT_AUDIENCE,
            "iss": iss if iss is not None else test_settings.jwt_issuer,
            "iat": now,
            "exp": now + exp_delta,
        }
        if extra_claims:
            payload.update(extra_claims)

        headers = {}
        if kid is not None:
            headers["kid"] = kid

        key_to_use = signing_key if signing_key is not None else private_key
        return jwt.encode(payload, key=key_to_use, algorithm=algorithm, headers=headers)

    return _build


@pytest.fixture
async def client(test_settings, mock_http_client):
    """Configured AsyncClient for exercising the FastAPI application."""
    with patch("app.core.deps.get_settings", return_value=test_settings), \
         patch("app.core.config.get_settings", return_value=test_settings):
        application = create_app(test_settings)
        application.state.http_client = mock_http_client
        application.dependency_overrides[get_settings] = lambda: test_settings

        transport = httpx.ASGITransport(app=application)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as test_client:
            yield test_client
