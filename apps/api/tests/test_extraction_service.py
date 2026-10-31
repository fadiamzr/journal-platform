"""
Tests for ExtractionService — in-memory fake admin client, mocked provider.
No network calls, no real PDFs.
"""

from __future__ import annotations

import copy
from typing import Any
from unittest.mock import AsyncMock

import pytest

from app.llm.base import LLMInvalidResponse, LLMQuotaExceeded, LLMUnavailable, PDFTooLarge
from app.llm.limiter import ExtractionLimiter
from app.llm.schemas import ExtractionResult
from app.services.extraction import ExtractionService

# ---------------------------------------------------------------------------
# Minimal valid PDF bytes
# ---------------------------------------------------------------------------

def _make_pdf() -> bytes:
    return (
        b"%PDF-1.4\n"
        b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
        b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
        b"3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n"
        b"xref\n0 4\n"
        b"0000000000 65535 f \n"
        b"0000000009 00000 n \n"
        b"0000000068 00000 n \n"
        b"0000000125 00000 n \n"
        b"trailer\n<< /Size 4 /Root 1 0 R >>\n"
        b"startxref\n207\n%%EOF"
    )


# ---------------------------------------------------------------------------
# In-memory fake admin client
# ---------------------------------------------------------------------------

class FakeAdminClient:
    """
    In-memory fake SupabaseAdminClient for service/route tests.
    Tracks all writes for assertions.
    """

    def __init__(
        self,
        submission: dict[str, Any] | None = None,
        version: dict[str, Any] | None = None,
        pdf_bytes: bytes | None = None,
        download_error: Exception | None = None,
    ) -> None:
        self._submission = submission or {
            "id": "aaaa0000-0000-0000-0000-000000000001",
            "author_id": "user-1",
            "status": "draft",
            "current_round": 1,
            "extraction_status": "not_started",
            "extraction_error": None,
            "manuscript_language": "en",
        }
        self._version = version or {
            "submission_id": "aaaa0000-0000-0000-0000-000000000001",
            "round": 1,
            "manuscript_path": "user-1/aaaa0000-0000-0000-0000-000000000001/v1.pdf",
        }
        self._pdf = pdf_bytes or _make_pdf()
        self._download_error = download_error

        # Write trackers
        self.updates: list[dict] = []
        self.author_replacements: list[list] = []
        self.claim_calls: list = []

    async def get_submission(self, submission_id: str) -> dict[str, Any] | None:
        if self._submission is None:
            return None
        # Return latest state including any updates
        return copy.deepcopy(self._submission)

    async def get_version(self, submission_id: str, round_num: int) -> dict[str, Any] | None:
        return self._version

    async def download_object(self, bucket: str, path: str) -> bytes:
        if self._download_error is not None:
            raise self._download_error
        return self._pdf

    async def update_submission(self, submission_id: str, data: dict[str, Any]) -> bool:
        self.updates.append({"submission_id": submission_id, **data})
        # Simulate the DB updating the local state
        self._submission.update(data)
        return True

    async def replace_authors(
        self, submission_id: str, authors: list[dict[str, Any]]
    ) -> bool:
        self.author_replacements.append(authors)
        return True

    async def list_authors(self, submission_id: str) -> list[dict[str, Any]]:
        return []

    async def claim_extraction(
        self, submission_id: str, stale_before_iso: str
    ) -> dict[str, Any] | None:
        self.claim_calls.append(submission_id)
        return copy.deepcopy(self._submission)


# ---------------------------------------------------------------------------
# Extraction result fixture
# ---------------------------------------------------------------------------

GOOD_RESULT = ExtractionResult.model_validate({
    "language": "fr",
    "title": {"en": None, "fr": "Un titre", "ar": None},
    "abstract": {"en": None, "fr": "Un résumé.", "ar": None},
    "keywords": {"en": [], "fr": ["mot-clé"], "ar": []},
    "authors": [
        {
            "full_name": "Jean Dupont",
            "affiliations": ["Université de Paris", "CNRS"],
            "email": "jean@univ.fr",
            "orcid": "0000-0002-1825-0097",
            "is_corresponding": True,
        }
    ],
    "notes": None,
})


async def _instant_limiter():
    """Context manager that yields immediately (no waiting)."""
    return ExtractionLimiter(max_concurrent=10, max_rpm=600)


# ---------------------------------------------------------------------------
# Build a fast limiter for tests (no actual waiting)
# ---------------------------------------------------------------------------

def make_fast_limiter() -> ExtractionLimiter:
    clock_val = [0.0]
    slept = [0.0]

    async def fake_sleep(s: float) -> None:
        slept[0] += s
        clock_val[0] += s

    def fake_clock() -> float:
        return clock_val[0]

    return ExtractionLimiter(max_concurrent=10, max_rpm=600, clock=fake_clock, sleep=fake_sleep)


# ---------------------------------------------------------------------------
# Happy path test
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_service_happy_path_writes_correct_data():
    admin = FakeAdminClient()
    provider_mock = AsyncMock()
    provider_mock.extract_metadata = AsyncMock(return_value=GOOD_RESULT)
    provider_mock.provider_name = "gemini"
    provider_mock.model = "test-model"

    service = ExtractionService(admin=admin, provider=provider_mock, limiter=make_fast_limiter())
    await service.run("aaaa0000-0000-0000-0000-000000000001")

    # Should have exactly one update to succeeded
    succeeded_updates = [u for u in admin.updates if u.get("extraction_status") == "succeeded"]
    assert len(succeeded_updates) == 1
    update = succeeded_updates[0]

    assert update["manuscript_language"] == "fr"
    assert update["title"] == {"fr": "Un titre"}  # only non-None locales
    assert update["abstract"] == {"fr": "Un résumé."}
    assert update["keywords"] == {"fr": ["mot-clé"]}
    assert update["extraction_error"] is None

    # Authors replaced once
    assert len(admin.author_replacements) == 1
    authors = admin.author_replacements[0]
    assert len(authors) == 1
    assert authors[0]["full_name"] == "Jean Dupont"
    # Affiliations joined with "; "
    assert authors[0]["affiliation"] == "Université de Paris; CNRS"
    assert authors[0]["email"] == "jean@univ.fr"
    assert authors[0]["orcid"] == "0000-0002-1825-0097"
    assert authors[0]["is_corresponding"] is True


# ---------------------------------------------------------------------------
# Failure paths
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_service_download_error_sets_failed():
    admin = FakeAdminClient(download_error=RuntimeError("S3 connection refused"))
    provider_mock = AsyncMock()
    provider_mock.provider_name = "gemini"
    provider_mock.model = "test-model"

    service = ExtractionService(admin=admin, provider=provider_mock, limiter=make_fast_limiter())
    await service.run("aaaa0000-0000-0000-0000-000000000001")

    failed_updates = [u for u in admin.updates if u.get("extraction_status") == "failed"]
    assert len(failed_updates) == 1
    # extraction_error must not contain the runtime message verbatim (it's a RuntimeError
    # not an LLMError, so public message is generic)
    assert "S3" not in failed_updates[0].get("extraction_error", "")


@pytest.mark.asyncio
async def test_service_quota_exceeded_sets_failed_with_safe_message():
    admin = FakeAdminClient()
    provider_mock = AsyncMock()
    provider_mock.extract_metadata = AsyncMock(
        side_effect=LLMQuotaExceeded("quota exceeded internally")
    )
    provider_mock.provider_name = "gemini"
    provider_mock.model = "test-model"

    service = ExtractionService(admin=admin, provider=provider_mock, limiter=make_fast_limiter())
    await service.run("aaaa0000-0000-0000-0000-000000000001")

    failed = [u for u in admin.updates if u.get("extraction_status") == "failed"]
    assert len(failed) == 1
    # Public message should be the user-safe one, not the internal detail
    assert "quota" in failed[0]["extraction_error"].lower()
    assert "internally" not in failed[0]["extraction_error"]


@pytest.mark.asyncio
async def test_service_invalid_response_sets_failed():
    admin = FakeAdminClient()
    provider_mock = AsyncMock()
    provider_mock.extract_metadata = AsyncMock(
        side_effect=LLMInvalidResponse("bad json from model")
    )
    provider_mock.provider_name = "gemini"
    provider_mock.model = "test-model"

    service = ExtractionService(admin=admin, provider=provider_mock, limiter=make_fast_limiter())
    await service.run("aaaa0000-0000-0000-0000-000000000001")

    failed = [u for u in admin.updates if u.get("extraction_status") == "failed"]
    assert len(failed) == 1
    assert "bad json" not in failed[0]["extraction_error"]


@pytest.mark.asyncio
async def test_service_pdf_too_large_sets_failed():
    admin = FakeAdminClient()
    provider_mock = AsyncMock()
    provider_mock.extract_metadata = AsyncMock(
        side_effect=PDFTooLarge("file is 25 MB")
    )
    provider_mock.provider_name = "gemini"
    provider_mock.model = "test-model"

    service = ExtractionService(admin=admin, provider=provider_mock, limiter=make_fast_limiter())
    await service.run("aaaa0000-0000-0000-0000-000000000001")

    failed = [u for u in admin.updates if u.get("extraction_status") == "failed"]
    assert len(failed) == 1


# ---------------------------------------------------------------------------
# Safety guard: does NOT write when submission is no longer a draft
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_service_does_not_write_when_not_draft():
    """
    After LLM call succeeds, service re-fetches the submission.
    If status changed from draft, it must NOT write anything.
    """
    admin = FakeAdminClient()
    provider_mock = AsyncMock()

    call_count = [0]

    async def slow_extract(pdf_bytes: bytes) -> ExtractionResult:
        call_count[0] += 1
        # Simulate status changing while we were extracting
        admin._submission["status"] = "published"
        return GOOD_RESULT

    provider_mock.extract_metadata = slow_extract
    provider_mock.provider_name = "gemini"
    provider_mock.model = "test-model"

    service = ExtractionService(admin=admin, provider=provider_mock, limiter=make_fast_limiter())
    await service.run("aaaa0000-0000-0000-0000-000000000001")

    # No succeeded update should have been written
    succeeded = [u for u in admin.updates if u.get("extraction_status") == "succeeded"]
    assert len(succeeded) == 0


# ---------------------------------------------------------------------------
# Error message max 300 chars, no secrets
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_service_error_message_truncated_to_300():
    admin = FakeAdminClient()

    long_msg = "A" * 500
    provider_mock = AsyncMock()
    provider_mock.extract_metadata = AsyncMock(
        side_effect=LLMUnavailable(long_msg, public_message=long_msg)
    )
    provider_mock.provider_name = "gemini"
    provider_mock.model = "test-model"

    service = ExtractionService(admin=admin, provider=provider_mock, limiter=make_fast_limiter())
    await service.run("aaaa0000-0000-0000-0000-000000000001")

    failed = [u for u in admin.updates if u.get("extraction_status") == "failed"]
    assert len(failed[0]["extraction_error"]) <= 300
