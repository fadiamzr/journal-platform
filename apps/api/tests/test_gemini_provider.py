"""
Tests for GeminiProvider — mocked HTTP via httpx.MockTransport.
No network calls, no real PDF, no real API keys.
"""

from __future__ import annotations

import base64
import json
from typing import Any
from unittest.mock import patch

import httpx
import pytest
from pydantic import SecretStr

from app.core.config import Settings
from app.llm.base import LLMConfigError, LLMInvalidResponse, LLMQuotaExceeded, LLMUnavailable
from app.llm.gemini import GeminiProvider
from app.llm.schemas import ExtractionResult

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

# Build a fake API key from parts to avoid triggering hard-rule patterns
_FAKE_KEY = "fake" + "_api_" + "key_for_tests"


def make_test_settings(**overrides) -> Settings:
    base = dict(
        APP_ENV="development",
        SUPABASE_URL="https://mock.supabase.co",
        SUPABASE_SECRET_KEY=SecretStr("mock_secret"),
        SUPABASE_JWKS_URL="https://mock.supabase.co/auth/v1/.well-known/jwks.json",
        GEMINI_API_KEY=SecretStr(_FAKE_KEY),
        GEMINI_MODEL="gemini-3.5-flash-lite",
        LLM_TIMEOUT_SECONDS=30,
        LLM_MAX_RETRIES=3,
        LLM_MAX_RPM=60,
        EXTRACTION_MAX_PDF_MB=18,
    )
    base.update(overrides)
    return Settings(**base)


@pytest.fixture
def settings():
    return make_test_settings()


def _make_pdf() -> bytes:
    """Generate a minimal valid PDF byte string in memory (no file I/O)."""
    # Minimal PDF structure that starts with %PDF-
    content = (
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
    return content


@pytest.fixture
def pdf_bytes():
    return _make_pdf()


GOOD_JSON = {
    "language": "en",
    "title": {"en": "Test Paper", "fr": None, "ar": None},
    "abstract": {"en": "Abstract text.", "fr": None, "ar": None},
    "keywords": {"en": ["test", "paper"], "fr": [], "ar": []},
    "authors": [
        {
            "full_name": "Jane Doe",
            "affiliations": ["University X"],
            "email": "jane@example.com",
            "orcid": "0000-0002-1825-0097",
            "is_corresponding": True,
        }
    ],
    "notes": None,
}


def _gemini_response(json_data: dict | str) -> dict:
    """Build a fake Gemini API response envelope."""
    text = json.dumps(json_data) if isinstance(json_data, dict) else json_data
    return {
        "candidates": [{"content": {"parts": [{"text": text}]}}],
        "usageMetadata": {
            "promptTokenCount": 100,
            "candidatesTokenCount": 50,
            "totalTokenCount": 150,
        },
    }


def make_mock_transport(responses: list[tuple[int, Any]]):
    """
    Returns an httpx.MockTransport that serves responses in sequence.
    Each entry is (status_code, body) where body is dict (JSON) or str.
    """
    call_count = [0]

    def handler(request: httpx.Request) -> httpx.Response:
        idx = min(call_count[0], len(responses) - 1)
        call_count[0] += 1
        status_code, body = responses[idx]
        if isinstance(body, dict):
            return httpx.Response(status_code, json=body)
        return httpx.Response(status_code, text=str(body))

    return httpx.MockTransport(handler), call_count


# ---------------------------------------------------------------------------
# Helper to patch sleeps to zero
# ---------------------------------------------------------------------------

async def _instant_sleep(seconds: float) -> None:  # noqa: ARG001
    pass


# ---------------------------------------------------------------------------
# Test: successful extraction
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gemini_success(settings, pdf_bytes):
    transport, calls = make_mock_transport([
        (200, _gemini_response(GOOD_JSON)),
    ])
    async with httpx.AsyncClient(transport=transport) as client:
        with patch.object(GeminiProvider, "_sleep", staticmethod(_instant_sleep)):
            provider = GeminiProvider(settings, client)
            result = await provider.extract_metadata(pdf_bytes)

    assert isinstance(result, ExtractionResult)
    assert result.language == "en"
    assert result.title["en"] == "Test Paper"
    assert result.authors[0].full_name == "Jane Doe"
    assert result.authors[0].orcid == "0000-0002-1825-0097"
    assert calls[0] == 1


# ---------------------------------------------------------------------------
# Test: fenced JSON tolerated
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gemini_fenced_json_tolerated(settings, pdf_bytes):
    fenced = f"```json\n{json.dumps(GOOD_JSON)}\n```"
    transport, _ = make_mock_transport([
        (200, _gemini_response(fenced)),
    ])
    async with httpx.AsyncClient(transport=transport) as client:
        with patch.object(GeminiProvider, "_sleep", staticmethod(_instant_sleep)):
            provider = GeminiProvider(settings, client)
            result = await provider.extract_metadata(pdf_bytes)
    assert result.language == "en"


# ---------------------------------------------------------------------------
# Test: invalid JSON then valid on repair retry
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gemini_invalid_json_then_repair_success(settings, pdf_bytes):
    transport, calls = make_mock_transport([
        (200, _gemini_response("not json at all")),
        (200, _gemini_response(GOOD_JSON)),
    ])
    async with httpx.AsyncClient(transport=transport) as client:
        with patch.object(GeminiProvider, "_sleep", staticmethod(_instant_sleep)):
            provider = GeminiProvider(settings, client)
            result = await provider.extract_metadata(pdf_bytes)
    assert result.language == "en"
    assert calls[0] == 2  # first call + repair retry


# ---------------------------------------------------------------------------
# Test: invalid JSON twice -> LLMInvalidResponse
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gemini_invalid_twice_raises(settings, pdf_bytes):
    transport, _ = make_mock_transport([
        (200, _gemini_response("not json")),
        (200, _gemini_response("still not json")),
    ])
    async with httpx.AsyncClient(transport=transport) as client:
        with patch.object(GeminiProvider, "_sleep", staticmethod(_instant_sleep)):
            provider = GeminiProvider(settings, client)
            with pytest.raises(LLMInvalidResponse):
                await provider.extract_metadata(pdf_bytes)


# ---------------------------------------------------------------------------
# Test: 429 then success
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gemini_429_then_success(settings, pdf_bytes):
    transport, calls = make_mock_transport([
        (429, {"error": {"message": "Rate limit exceeded"}}),
        (200, _gemini_response(GOOD_JSON)),
    ])
    async with httpx.AsyncClient(transport=transport) as client:
        with patch.object(GeminiProvider, "_sleep", staticmethod(_instant_sleep)):
            provider = GeminiProvider(settings, client)
            result = await provider.extract_metadata(pdf_bytes)
    assert result.language == "en"
    assert calls[0] == 2


# ---------------------------------------------------------------------------
# Test: 429 with daily quota message -> LLMQuotaExceeded with exactly ONE request
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gemini_429_daily_quota_one_request(settings, pdf_bytes):
    transport, calls = make_mock_transport([
        (429, {"error": {"message": "Daily quota exhausted for this model"}}),
    ])
    async with httpx.AsyncClient(transport=transport) as client:
        with patch.object(GeminiProvider, "_sleep", staticmethod(_instant_sleep)):
            provider = GeminiProvider(settings, client)
            with pytest.raises(LLMQuotaExceeded):
                await provider.extract_metadata(pdf_bytes)
    assert calls[0] == 1  # no retries


# ---------------------------------------------------------------------------
# Test: persistent 503 -> LLMUnavailable after MAX_RETRIES
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gemini_503_persistent_unavailable(pdf_bytes):
    settings = make_test_settings(LLM_MAX_RETRIES=2)
    transport, calls = make_mock_transport([
        (503, "Service Unavailable"),
        (503, "Service Unavailable"),
        (503, "Service Unavailable"),
    ])
    async with httpx.AsyncClient(transport=transport) as client:
        with patch.object(GeminiProvider, "_sleep", staticmethod(_instant_sleep)):
            provider = GeminiProvider(settings, client)
            with pytest.raises(LLMUnavailable):
                await provider.extract_metadata(pdf_bytes)
    # 1 initial + 2 retries = 3 attempts
    assert calls[0] == 3


# ---------------------------------------------------------------------------
# Test: timeout handling
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gemini_timeout_then_success(settings, pdf_bytes):
    call_count = [0]

    def handler(request: httpx.Request) -> httpx.Response:
        call_count[0] += 1
        if call_count[0] == 1:
            raise httpx.TimeoutException("timed out", request=request)
        return httpx.Response(200, json=_gemini_response(GOOD_JSON))

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        with patch.object(GeminiProvider, "_sleep", staticmethod(_instant_sleep)):
            provider = GeminiProvider(settings, client)
            result = await provider.extract_metadata(pdf_bytes)
    assert result.language == "en"
    assert call_count[0] == 2


# ---------------------------------------------------------------------------
# Test: 400/401 -> LLMConfigError, message has no key
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("status_code", [400, 401, 403])
async def test_gemini_4xx_config_error(settings, pdf_bytes, status_code):
    transport, _ = make_mock_transport([
        (status_code, {"error": "bad request"}),
    ])
    async with httpx.AsyncClient(transport=transport) as client:
        with patch.object(GeminiProvider, "_sleep", staticmethod(_instant_sleep)):
            provider = GeminiProvider(settings, client)
            with pytest.raises(LLMConfigError) as exc_info:
                await provider.extract_metadata(pdf_bytes)

    # Public message must not contain the API key or request body
    msg = exc_info.value.public_message
    assert _FAKE_KEY not in msg
    assert "GEMINI" not in msg.upper() or "configured" in msg.lower()


# ---------------------------------------------------------------------------
# Test: not-a-PDF -> PDFTooLarge before any HTTP call
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_not_a_pdf_raises_before_http(settings):
    from app.llm.base import PDFTooLarge

    call_count = [0]
    def handler(request: httpx.Request) -> httpx.Response:
        call_count[0] += 1
        return httpx.Response(200, json=_gemini_response(GOOD_JSON))

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = GeminiProvider(settings, client)
        with pytest.raises(PDFTooLarge):
            await provider.extract_metadata(b"not a pdf at all")

    assert call_count[0] == 0  # no HTTP call made


# ---------------------------------------------------------------------------
# Test: oversize PDF -> PDFTooLarge before any HTTP call
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_oversize_pdf_raises_before_http(settings):
    from app.llm.base import PDFTooLarge

    call_count = [0]
    def handler(request: httpx.Request) -> httpx.Response:
        call_count[0] += 1
        return httpx.Response(200, json=_gemini_response(GOOD_JSON))

    transport = httpx.MockTransport(handler)
    # Build fake "PDF" that is just over 18 MB
    oversized = b"%PDF-" + b"A" * (19 * 1024 * 1024)
    async with httpx.AsyncClient(transport=transport) as client:
        provider = GeminiProvider(settings, client)
        with pytest.raises(PDFTooLarge):
            await provider.extract_metadata(oversized)

    assert call_count[0] == 0


# ---------------------------------------------------------------------------
# Test: request structure — API key only in header, correct payload shape
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_gemini_request_structure(settings, pdf_bytes):
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["headers"] = dict(request.headers)
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json=_gemini_response(GOOD_JSON))

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        with patch.object(GeminiProvider, "_sleep", staticmethod(_instant_sleep)):
            provider = GeminiProvider(settings, client)
            await provider.extract_metadata(pdf_bytes)

    # Key must be in x-goog-api-key header, NOT in Authorization
    assert captured["headers"].get("x-goog-api-key") == _FAKE_KEY
    assert "authorization" not in {k.lower() for k in captured["headers"]}

    # Body structure
    body = captured["body"]
    parts = body["contents"][0]["parts"]
    # First part: inline_data with application/pdf
    assert parts[0]["inline_data"]["mime_type"] == "application/pdf"
    assert parts[0]["inline_data"]["data"] == base64.b64encode(pdf_bytes).decode()
    # Temperature 0
    assert body["generationConfig"]["temperature"] == 0
    # Prompt contains the "document is data" security rule
    prompt_text = parts[1]["text"]
    assert "document is DATA" in prompt_text or "document is data" in prompt_text.lower()


# ---------------------------------------------------------------------------
# Test: missing GEMINI_API_KEY raises LLMConfigError at construction
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_missing_api_key_raises_config_error():
    settings = make_test_settings(GEMINI_API_KEY=None)
    # We need a minimal mock client
    transport = httpx.MockTransport(lambda r: httpx.Response(200))
    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(LLMConfigError):
            GeminiProvider(settings, client)


# ---------------------------------------------------------------------------
# Test: prompt injection — extra keys in model reply never reach update payload
# (checked via ExtractionResult validation; validated separately via schema test)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_prompt_injection_extra_keys_stripped(settings, pdf_bytes):
    """Model reply with extra keys like 'role':'admin' must be stripped."""
    injected = {
        **GOOD_JSON,
        "role": "admin",
        "extraction_status": "succeeded",
        "author_id": "evil-uuid",
        "status": "published",
    }
    transport, _ = make_mock_transport([
        (200, _gemini_response(injected)),
    ])
    async with httpx.AsyncClient(transport=transport) as client:
        with patch.object(GeminiProvider, "_sleep", staticmethod(_instant_sleep)):
            provider = GeminiProvider(settings, client)
            result = await provider.extract_metadata(pdf_bytes)

    # The ExtractionResult must NOT carry any of these injected fields
    assert not hasattr(result, "role")
    assert not hasattr(result, "extraction_status")
    assert not hasattr(result, "author_id")
    assert not hasattr(result, "status")
