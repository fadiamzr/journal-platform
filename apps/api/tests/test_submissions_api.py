"""
Integration and API tests for submissions, file uploads, and blind-copy verification flow.
Uses in-memory fake clients for deterministic, offline testing.
"""

from __future__ import annotations

import io
import uuid
from typing import Any

import httpx
import pytest
from fastapi import Depends, HTTPException
from pydantic import SecretStr
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

from app.clients.supabase_admin import SupabaseAdminClient, get_supabase_admin
from app.clients.supabase_user import SupabaseUserClient, get_user_client
from app.core.config import Settings, get_settings
from app.core.deps import Role, get_current_user
from app.main import create_app


def _make_pdf_bytes(text: str = "Academic Paper Content") -> bytes:
    writer = PdfWriter()
    page = writer.add_blank_page(width=200, height=200)
    font_dict = DictionaryObject({
        NameObject("/Type"): NameObject("/Font"),
        NameObject("/Subtype"): NameObject("/Type1"),
        NameObject("/BaseFont"): NameObject("/Helvetica"),
    })
    page[NameObject("/Resources")] = DictionaryObject({
        NameObject("/Font"): DictionaryObject({NameObject("/F1"): font_dict})
    })
    content = f"BT /F1 12 Tf 20 100 Td ({text}) Tj ET".encode("latin-1")
    stream = DecodedStreamObject()
    stream.set_data(content)
    page[NameObject("/Contents")] = stream
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


class FakeBackend:
    """In-memory database and storage backing fake clients."""

    def __init__(self):
        self.submissions: dict[str, dict[str, Any]] = {}
        self.authors: dict[str, list[dict[str, Any]]] = {}
        self.versions: dict[tuple[str, int], dict[str, Any]] = {}
        self.history: dict[str, list[dict[str, Any]]] = {}
        self.storage: dict[tuple[str, str], bytes] = {}
        self.profiles: dict[str, dict[str, Any]] = {}
        self.last_user_token: str | None = None


class FakeUserClient(SupabaseUserClient):
    """User client interacting with in-memory store with RLS semantics."""

    def __init__(self, backend: FakeBackend, user_id: str, role: Role | None, token: str):
        self.backend = backend
        self.user_id = user_id
        self.role = role
        self.token = token
        self.backend.last_user_token = token

    async def select(self, table: str, params: dict[str, Any] | None = None, headers=None):
        if table == "submissions":
            sub_id = params.get("id", "").replace("eq.", "") if params else ""
            if sub_id:
                sub = self.backend.submissions.get(sub_id)
                if not sub:
                    return []
                # RLS check: owner or editor/admin
                if sub["author_id"] == self.user_id or self.role in (Role.EDITOR, Role.ADMIN):
                    return [sub]
                return []
            # List query
            results = list(self.backend.submissions.values())
            if self.role not in (Role.EDITOR, Role.ADMIN):
                results = [s for s in results if s["author_id"] == self.user_id]
            if params and "status" in params:
                st = params["status"].replace("eq.", "")
                results = [s for s in results if s["status"] == st]
            return results

        if table == "submission_authors":
            sub_id = params.get("submission_id", "").replace("eq.", "") if params else ""
            return self.backend.authors.get(sub_id, [])

        if table == "submission_versions":
            sub_id = params.get("submission_id", "").replace("eq.", "") if params else ""
            return [v for (sid, _), v in self.backend.versions.items() if sid == sub_id]

        if table == "submission_status_history":
            sub_id = params.get("submission_id", "").replace("eq.", "") if params else ""
            return self.backend.history.get(sub_id, [])

        return []

    async def insert(self, table: str, data: Any, return_representation: bool = True):
        now = "2026-10-29T10:00:00Z"
        if table == "submissions":
            row = dict(data)
            row.setdefault("id", str(uuid.uuid4()))
            row.setdefault("created_at", now)
            row.setdefault("updated_at", now)
            row.setdefault("current_round", 1)
            row.setdefault("extraction_status", "not_started")
            self.backend.submissions[row["id"]] = row
            return [row]

        if table == "submission_authors":
            rows = data if isinstance(data, list) else [data]
            for r in rows:
                sub_id = r["submission_id"]
                self.backend.authors.setdefault(sub_id, []).append(dict(r))
            return rows

        return []

    async def update(
        self,
        table: str,
        data: dict[str, Any],
        params: dict[str, Any] | None = None,
        **kwargs,
    ):
        if table == "submissions":
            sub_id = params.get("id", "").replace("eq.", "") if params else ""
            sub = self.backend.submissions.get(sub_id)
            if not sub:
                return []
            old_status = sub["status"]
            sub.update(data)
            sub["updated_at"] = "2026-10-29T10:05:00Z"
            if old_status == "revisions_requested" and sub["status"] == "submitted":
                sub["current_round"] = sub.get("current_round", 1) + 1
            if "status" in data and data["status"] != old_status:
                self.backend.history.setdefault(sub_id, []).append({
                    "submission_id": sub_id,
                    "from_status": old_status,
                    "to_status": data["status"],
                    "changed_at": "2026-10-29T10:05:00Z",
                })
            return [sub]
        return []

    async def delete(self, table: str, params: dict[str, Any] | None = None, **kwargs):
        if table == "submission_authors":
            sub_id = params.get("submission_id", "").replace("eq.", "") if params else ""
            self.backend.authors[sub_id] = []
            return []
        return []

    async def rpc(self, fn: str, params: dict[str, Any] | None = None) -> Any:
        """Stub: no RPC functions used in current routes. Returns None."""
        return None


class FakeAdminClient(SupabaseAdminClient):
    """Admin client with storage and privileged DB operations."""

    def __init__(self, backend: FakeBackend):
        self.backend = backend
        self.base_url = "https://mock.supabase.co"
        self.secret_key = "sb_" + "secret_fake_admin_key"

    async def get_submission(self, submission_id: str) -> dict[str, Any] | None:
        return self.backend.submissions.get(submission_id)

    async def get_authors(self, submission_id: str) -> list[dict[str, Any]]:
        return self.backend.authors.get(submission_id, [])

    async def get_version_row(self, submission_id: str, round_num: int) -> dict[str, Any] | None:
        return self.backend.versions.get((submission_id, round_num))

    async def upsert_version_row(self, data: dict[str, Any]) -> dict[str, Any]:
        key = (data["submission_id"], data["round"])
        existing = self.backend.versions.get(key, {})
        existing.update(data)
        existing.setdefault("created_at", "2026-10-29T10:00:00Z")
        self.backend.versions[key] = existing
        return existing

    async def update_version_fields(
        self,
        submission_id: str,
        round_num: int,
        fields: dict[str, Any],
    ) -> dict[str, Any]:
        key = (submission_id, round_num)
        existing = self.backend.versions.get(key, {})
        existing.update(fields)
        self.backend.versions[key] = existing
        return existing

    async def get_profile(self, user_id: str) -> dict[str, Any] | None:
        return self.backend.profiles.get(
            user_id,
            {"id": user_id, "full_name": "Test User"},
        )

    async def upload_object(
        self,
        bucket: str,
        path: str,
        data: bytes,
        content_type: str = "application/pdf",
        upsert=True,
    ):
        self.backend.storage[(bucket, path)] = data
        return {"path": path}

    async def create_signed_url(self, bucket: str, path: str, expires_in: int = 300) -> str:
        return f"{self.base_url}/storage/v1/object/sign/{bucket}/{path}?token=mock_signed_300s"

    async def delete_object(self, bucket: str, path: str) -> bool:
        """Remove object from in-memory storage store."""
        key = (bucket, path)
        if key in self.backend.storage:
            del self.backend.storage[key]
            return True
        return False


@pytest.fixture
def fake_backend():
    return FakeBackend()


@pytest.fixture
async def api_client(test_settings, mock_http_client, fake_backend):
    test_settings.SUPABASE_PUBLISHABLE_KEY = "sb_" + "publishable_fake_key"
    app = create_app(test_settings)
    app.state.http_client = mock_http_client

    fake_admin = FakeAdminClient(fake_backend)
    app.dependency_overrides[get_supabase_admin] = lambda: fake_admin

    def override_get_user_client(
        user=Depends(get_current_user),
        settings=Depends(get_settings),
    ):
        if not settings.SUPABASE_PUBLISHABLE_KEY.strip():
            raise HTTPException(
                status_code=503,
                detail="SUPABASE_PUBLISHABLE_KEY is not configured",
            )
        return FakeUserClient(
            backend=fake_backend,
            user_id=user.user_id,
            role=user.user_role,
            token=user.token,
        )

    app.dependency_overrides[get_user_client] = override_get_user_client

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac, fake_backend, app


# ---------------------------------------------------------------------------
# API Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_anonymous_returns_401(api_client):
    client, _, _ = api_client
    resp = await client.get("/submissions")
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.asyncio
async def test_uuid_validation_422(api_client, token_builder):
    client, _, _ = api_client
    token = token_builder(user_role="author")
    headers = {"Authorization": f"Bearer {token}"}
    resp = await client.get("/submissions/not-a-valid-uuid", headers=headers)
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_draft_and_invalid_language(api_client, token_builder):
    client, backend, _ = api_client
    author_id = str(uuid.uuid4())
    token = token_builder(sub=author_id, user_role="author")
    headers = {"Authorization": f"Bearer {token}"}

    # Invalid language
    resp_bad = await client.post(
        "/submissions",
        json={"manuscript_language": "de"},
        headers=headers,
    )
    assert resp_bad.status_code == 422

    # Valid draft
    resp = await client.post(
        "/submissions",
        json={"manuscript_language": "en"},
        headers=headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "draft"
    assert data["manuscript_language"] == "en"
    assert data["current_round"] == 1
    sub_id = data["id"]
    assert sub_id in backend.submissions


@pytest.mark.asyncio
async def test_author_isolation_and_listing(api_client, token_builder):
    client, backend, _ = api_client
    author_1 = str(uuid.uuid4())
    author_2 = str(uuid.uuid4())
    token_1 = token_builder(sub=author_1, user_role="author")
    token_2 = token_builder(sub=author_2, user_role="author")
    editor_token = token_builder(user_role="editor")

    # Author 1 creates submission
    r1 = await client.post(
        "/submissions",
        json={"manuscript_language": "en"},
        headers={"Authorization": f"Bearer {token_1}"},
    )
    sub_1_id = r1.json()["id"]

    # Author 2 creates submission
    r2 = await client.post(
        "/submissions",
        json={"manuscript_language": "fr"},
        headers={"Authorization": f"Bearer {token_2}"},
    )
    sub_2_id = r2.json()["id"]

    # Author 1 lists: only sees sub_1
    list_1 = await client.get(
        "/submissions",
        headers={"Authorization": f"Bearer {token_1}"},
    )
    assert list_1.status_code == 200
    ids_1 = [s["id"] for s in list_1.json()]
    assert sub_1_id in ids_1
    assert sub_2_id not in ids_1

    # Author 1 detail on sub_2 -> 404
    d_bad = await client.get(
        f"/submissions/{sub_2_id}",
        headers={"Authorization": f"Bearer {token_1}"},
    )
    assert d_bad.status_code == 404

    # Editor sees all
    list_ed = await client.get(
        "/submissions",
        headers={"Authorization": f"Bearer {editor_token}"},
    )
    assert list_ed.status_code == 200
    ids_ed = [s["id"] for s in list_ed.json()]
    assert sub_1_id in ids_ed
    assert sub_2_id in ids_ed


@pytest.mark.asyncio
async def test_update_metadata_and_authors(api_client, token_builder):
    client, backend, _ = api_client
    author_id = str(uuid.uuid4())
    token = token_builder(sub=author_id, user_role="author")
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = await client.post(
        "/submissions",
        json={"manuscript_language": "en"},
        headers=headers,
    )
    sub_id = create_resp.json()["id"]

    # Update metadata
    meta_payload = {
        "title": {"en": "Machine Learning in Medicine"},
        "abstract": {"en": "An overview of AI applications."},
        "keywords": {"en": ["AI", "Health"]},
    }
    m_resp = await client.put(f"/submissions/{sub_id}/metadata", json=meta_payload, headers=headers)
    assert m_resp.status_code == 200
    assert m_resp.json()["title"] == {"en": "Machine Learning in Medicine"}

    # Update authors
    author_payload = {
        "authors": [
            {
                "full_name": "Dr. Jane Doe",
                "affiliations": ["University of Algiers", "Institute of Tech"],
                "email": "jane@example.com",
                "is_corresponding": True,
            }
        ]
    }
    a_resp = await client.put(
        f"/submissions/{sub_id}/authors",
        json=author_payload,
        headers=headers,
    )
    assert a_resp.status_code == 200
    authors = a_resp.json()
    assert len(authors) == 1
    assert authors[0]["full_name"] == "Dr. Jane Doe"
    assert authors[0]["affiliations"] == ["University of Algiers", "Institute of Tech"]


@pytest.mark.asyncio
async def test_manuscript_and_blind_copy_uploads(api_client, token_builder):
    client, backend, _ = api_client
    author_id = str(uuid.uuid4())
    token = token_builder(sub=author_id, user_role="author")
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = await client.post(
        "/submissions",
        json={"manuscript_language": "en"},
        headers=headers,
    )
    sub_id = create_resp.json()["id"]

    # Set metadata and authors first
    await client.put(
        f"/submissions/{sub_id}/metadata",
        json={"title": {"en": "Paper Title"}},
        headers=headers,
    )
    await client.put(
        f"/submissions/{sub_id}/authors",
        json={"authors": [{"full_name": "Alice Smith", "email": "alice@test.local"}]},
        headers=headers,
    )

    pdf_bytes = _make_pdf_bytes("Full manuscript content with Alice Smith")

    # Upload manuscript
    m_resp = await client.post(
        f"/submissions/{sub_id}/manuscript",
        files={"file": ("paper.pdf", pdf_bytes, "application/pdf")},
        headers=headers,
    )
    assert m_resp.status_code == 200
    m_data = m_resp.json()
    assert m_data["round"] == 1
    assert m_data["size"] > 0

    # Upload blind copy (with name trace)
    b_resp = await client.post(
        f"/submissions/{sub_id}/blind-copy",
        files={"file": ("blind.pdf", pdf_bytes, "application/pdf")},
        headers=headers,
    )
    assert b_resp.status_code == 200
    b_data = b_resp.json()
    assert b_data["round"] == 1
    # Warnings should detect Alice Smith
    assert len(b_data["warnings"]) >= 1
    assert b_data["warnings"][0]["type"] == "author_name"
    # Never expose matched text
    assert "text" not in b_data["warnings"][0]

    # Verify version info
    detail = await client.get(f"/submissions/{sub_id}", headers=headers)
    assert detail.status_code == 200
    versions = detail.json()["versions"]
    assert len(versions) == 1
    assert versions[0]["has_manuscript"] is True
    assert versions[0]["has_blind_copy"] is True
    assert versions[0]["blind_copy_verified"] is False
    # No storage paths in response
    assert "manuscript_path" not in detail.text
    assert "anonymized_path" not in detail.text


@pytest.mark.asyncio
async def test_submit_validation_lists_all_missing_items(api_client, token_builder):
    client, _, _ = api_client
    author_id = str(uuid.uuid4())
    token = token_builder(sub=author_id, user_role="author")
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = await client.post(
        "/submissions",
        json={"manuscript_language": "en"},
        headers=headers,
    )
    sub_id = create_resp.json()["id"]

    # Try submit immediately
    resp = await client.post(f"/submissions/{sub_id}/submit", headers=headers)
    assert resp.status_code == 422
    err_msg = resp.json()["error"]["message"]
    # All missing items should be listed
    assert "Manuscript PDF file is required" in err_msg
    assert "Blind copy PDF file is required" in err_msg
    assert "Title in manuscript language" in err_msg
    assert "At least one author must be declared" in err_msg


@pytest.mark.asyncio
async def test_submit_success_and_user_token_assertion(api_client, token_builder):
    client, backend, _ = api_client
    author_id = str(uuid.uuid4())
    token = token_builder(sub=author_id, user_role="author")
    headers = {"Authorization": f"Bearer {token}"}

    create_resp = await client.post(
        "/submissions",
        json={"manuscript_language": "en"},
        headers=headers,
    )
    sub_id = create_resp.json()["id"]

    await client.put(
        f"/submissions/{sub_id}/metadata",
        json={"title": {"en": "Complete Title"}},
        headers=headers,
    )
    await client.put(
        f"/submissions/{sub_id}/authors",
        json={"authors": [{"full_name": "Author One", "email": "a1@test.local"}]},
        headers=headers,
    )

    pdf = _make_pdf_bytes("Valid Paper")
    await client.post(
        f"/submissions/{sub_id}/manuscript",
        files={"file": ("m.pdf", pdf, "application/pdf")},
        headers=headers,
    )
    await client.post(
        f"/submissions/{sub_id}/blind-copy",
        files={"file": ("b.pdf", pdf, "application/pdf")},
        headers=headers,
    )

    # Submit
    submit_resp = await client.post(f"/submissions/{sub_id}/submit", headers=headers)
    assert submit_resp.status_code == 200
    assert submit_resp.json()["status"] == "submitted"
    assert backend.submissions[sub_id]["status"] == "submitted"

    # Assert that user client was invoked with the author's own token (not secret key)
    assert backend.last_user_token == token
    assert "secret" not in backend.last_user_token


@pytest.mark.asyncio
async def test_editor_workflow_and_conflict_of_interest(api_client, token_builder):
    client, backend, _ = api_client
    editor_id = str(uuid.uuid4())
    other_author_id = str(uuid.uuid4())

    editor_token = token_builder(sub=editor_id, user_role="editor")
    author_token = token_builder(sub=other_author_id, user_role="author")

    # Author creates and submits
    create_resp = await client.post(
        "/submissions",
        json={"manuscript_language": "en"},
        headers={"Authorization": f"Bearer {author_token}"},
    )
    sub_id = create_resp.json()["id"]
    await client.put(
        f"/submissions/{sub_id}/metadata",
        json={"title": {"en": "Title"}},
        headers={"Authorization": f"Bearer {author_token}"},
    )
    await client.put(
        f"/submissions/{sub_id}/authors",
        json={"authors": [{"full_name": "A", "email": "a@t.co"}]},
        headers={"Authorization": f"Bearer {author_token}"},
    )
    pdf = _make_pdf_bytes("Content")
    await client.post(
        f"/submissions/{sub_id}/manuscript",
        files={"file": ("m.pdf", pdf, "application/pdf")},
        headers={"Authorization": f"Bearer {author_token}"},
    )
    await client.post(
        f"/submissions/{sub_id}/blind-copy",
        files={"file": ("b.pdf", pdf, "application/pdf")},
        headers={"Authorization": f"Bearer {author_token}"},
    )
    await client.post(
        f"/submissions/{sub_id}/submit",
        headers={"Authorization": f"Bearer {author_token}"},
    )

    # 1. Start review before verification fails (409)
    start_early = await client.post(
        f"/submissions/{sub_id}/start-review",
        headers={"Authorization": f"Bearer {editor_token}"},
    )
    assert start_early.status_code == 409
    assert "blind copy has not been verified" in start_early.json()["error"]["message"]

    # 2. Author cannot call editor verify (403)
    auth_verify = await client.post(
        f"/submissions/{sub_id}/blind-copy/verify",
        headers={"Authorization": f"Bearer {author_token}"},
    )
    assert auth_verify.status_code == 403

    # 3. Editor rejects blind copy with note
    rej_resp = await client.post(
        f"/submissions/{sub_id}/blind-copy/reject",
        json={"note": "Author name still visible in Figure 2"},
        headers={"Authorization": f"Bearer {editor_token}"},
    )
    assert rej_resp.status_code == 200
    assert (
        backend.versions[(sub_id, 1)]["anonymized_review_note"]
        == "Author name still visible in Figure 2"
    )

    # 4. Editor verifies blind copy (idempotent)
    v1 = await client.post(
        f"/submissions/{sub_id}/blind-copy/verify",
        headers={"Authorization": f"Bearer {editor_token}"},
    )
    assert v1.status_code == 200
    assert backend.versions[(sub_id, 1)]["anonymized_verified_at"] is not None
    v2 = await client.post(
        f"/submissions/{sub_id}/blind-copy/verify",
        headers={"Authorization": f"Bearer {editor_token}"},
    )
    assert v2.status_code == 200

    # 5. Start review succeeds once verified
    start_ok = await client.post(
        f"/submissions/{sub_id}/start-review",
        headers={"Authorization": f"Bearer {editor_token}"},
    )
    assert start_ok.status_code == 200
    assert backend.submissions[sub_id]["status"] == "in_review"

    # 6. Conflict of interest: Editor creates own submission
    own_resp = await client.post(
        "/submissions",
        json={"manuscript_language": "en"},
        headers={"Authorization": f"Bearer {editor_token}"},
    )
    own_sub_id = own_resp.json()["id"]

    coi_verify = await client.post(
        f"/submissions/{own_sub_id}/blind-copy/verify",
        headers={"Authorization": f"Bearer {editor_token}"},
    )
    assert coi_verify.status_code == 403
    assert "conflict of interest" in coi_verify.json()["error"]["message"]

    coi_reject = await client.post(
        f"/submissions/{own_sub_id}/blind-copy/reject",
        json={"note": "note"},
        headers={"Authorization": f"Bearer {editor_token}"},
    )
    assert coi_reject.status_code == 403

    coi_start = await client.post(
        f"/submissions/{own_sub_id}/start-review",
        headers={"Authorization": f"Bearer {editor_token}"},
    )
    assert coi_start.status_code == 403


@pytest.mark.asyncio
async def test_signed_url_authorization(api_client, token_builder):
    client, backend, _ = api_client
    author_id = str(uuid.uuid4())
    other_id = str(uuid.uuid4())
    author_token = token_builder(sub=author_id, user_role="author")
    other_token = token_builder(sub=other_id, user_role="author")
    reviewer_token = token_builder(sub=other_id, user_role="reviewer")
    editor_token = token_builder(user_role="editor")

    # Author submission with manuscript
    cr = await client.post(
        "/submissions",
        json={"manuscript_language": "en"},
        headers={"Authorization": f"Bearer {author_token}"},
    )
    sub_id = cr.json()["id"]
    pdf = _make_pdf_bytes("Content")
    await client.post(
        f"/submissions/{sub_id}/manuscript",
        files={"file": ("m.pdf", pdf, "application/pdf")},
        headers={"Authorization": f"Bearer {author_token}"},
    )

    # Author downloads manuscript: allowed
    dl_author = await client.get(
        f"/submissions/{sub_id}/files/manuscript",
        headers={"Authorization": f"Bearer {author_token}"},
    )
    assert dl_author.status_code == 200
    assert "token=mock_signed_300s" in dl_author.json()["url"]

    # Editor downloads manuscript: allowed
    dl_ed = await client.get(
        f"/submissions/{sub_id}/files/manuscript",
        headers={"Authorization": f"Bearer {editor_token}"},
    )
    assert dl_ed.status_code == 200

    # Other author: 404
    dl_other = await client.get(
        f"/submissions/{sub_id}/files/manuscript",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert dl_other.status_code == 404

    # Reviewer on author files endpoint: 404
    dl_rev = await client.get(
        f"/submissions/{sub_id}/files/manuscript",
        headers={"Authorization": f"Bearer {reviewer_token}"},
    )
    assert dl_rev.status_code == 404


@pytest.mark.asyncio
async def test_publishable_key_missing_returns_503(token_builder, mock_http_client, fake_backend):
    # Setting with empty publishable key
    settings = Settings(
        APP_ENV="development",
        LOG_LEVEL="DEBUG",
        SUPABASE_URL="https://mock.supabase.co",
        SUPABASE_SECRET_KEY=SecretStr("mock_secret"),
        SUPABASE_JWKS_URL="https://mock.supabase.co/auth/v1/.well-known/jwks.json",
        SUPABASE_PUBLISHABLE_KEY="",  # missing
    )
    app = create_app(settings)
    app.state.http_client = mock_http_client
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_supabase_admin] = lambda: FakeAdminClient(fake_backend)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        token = token_builder(user_role="author")
        resp = await ac.get("/submissions", headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 503
        assert "SUPABASE_PUBLISHABLE_KEY is not configured" in resp.json()["error"]["message"]


@pytest.mark.asyncio
async def test_log_capture_never_contains_tokens_or_file_bytes(api_client, token_builder, caplog):
    client, _, _ = api_client
    caplog.set_level("DEBUG")

    author_id = str(uuid.uuid4())
    raw_token = token_builder(sub=author_id, user_role="author")
    secret_file_bytes = b"%PDF-1.4 UNMISTAKABLE_SECRET_BINARY_PAYLOAD_FOR_TEST %%EOF"

    cr = await client.post(
        "/submissions",
        json={"manuscript_language": "en"},
        headers={"Authorization": f"Bearer {raw_token}"},
    )
    sub_id = cr.json()["id"]

    await client.post(
        f"/submissions/{sub_id}/manuscript",
        files={"file": ("secret.pdf", secret_file_bytes, "application/pdf")},
        headers={"Authorization": f"Bearer {raw_token}"},
    )

    logged_text = caplog.text
    # Assert token string is not in log
    assert raw_token not in logged_text
    # Assert file payload is not in log
    assert "UNMISTAKABLE_SECRET_BINARY_PAYLOAD_FOR_TEST" not in logged_text
