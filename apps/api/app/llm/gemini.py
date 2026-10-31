"""
Gemini REST API provider for metadata extraction.

Sends the PDF as base64 inline_data directly to the Gemini API so that
Arabic text layers (which are often corrupted in PDF extraction) are handled
by the vision model instead of Python text extraction.

Security:
- The API key is sent ONLY in the x-goog-api-key request header.
- The key is never logged, never included in exception messages.
- PDF content is never logged.

Rate limiting / retry:
- Retries on HTTP 429, 500, 503, and network timeouts with exponential
  backoff + jitter, honoring Retry-After when present.
- A 429 whose body mentions a daily/per-day quota raises LLMQuotaExceeded
  immediately (no further retries).
- 400/401/403 raise LLMConfigError immediately.
- After LLM_MAX_RETRIES exhausted with 5xx/timeout → LLMUnavailable.

Response handling:
- Parses JSON tolerating ```json fences.
- On parse or validation failure: ONE repair retry (re-sending the same
  request with an extra line asking for valid JSON only).
- If repair also fails: raises LLMInvalidResponse.
"""

from __future__ import annotations

import base64
import json
import logging
import math
import random
import re
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import httpx

from app.llm.base import (
    LLMConfigError,
    LLMInvalidResponse,
    LLMQuotaExceeded,
    LLMUnavailable,
)
from app.llm.prompt import EXTRACTION_PROMPT
from app.llm.schemas import ExtractionResult

if TYPE_CHECKING:
    from app.core.config import Settings

logger = logging.getLogger(__name__)

_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
_JSON_FENCE_RE = re.compile(r"```(?:json)?\s*([\s\S]*?)```", re.IGNORECASE)
_DAILY_QUOTA_RE = re.compile(r"(daily|per.day|per_day|exhausted|quota)", re.IGNORECASE)
# Safe: matches nothing interesting; keep PDF byte detail out of logs
_PDF_HEADER = b"%PDF-"

REPAIR_SUFFIX = "\n\nReturn ONLY valid JSON. No markdown, no fences, no commentary."


@dataclass
class TokenUsage:
    """Token counts reported by the Gemini API for a single call."""

    prompt_tokens: int = 0
    candidates_tokens: int = 0
    total_tokens: int = 0


class GeminiProvider:
    """
    Gemini REST API provider implementing the LLMProvider protocol.

    Uses the shared httpx.AsyncClient from the application lifespan.
    """

    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:
        api_key = settings.GEMINI_API_KEY
        if api_key is None:
            raise LLMConfigError(
                "GEMINI_API_KEY is not configured",
                public_message="AI provider is not properly configured.",
            )
        secret = api_key.get_secret_value()
        if not secret.strip():
            raise LLMConfigError(
                "GEMINI_API_KEY is empty",
                public_message="AI provider is not properly configured.",
            )
        # Store the key in a local variable; never assign to a logged attribute name
        self._key = secret
        model = settings.GEMINI_MODEL or "gemini-3.5-flash-lite"
        self._model = model
        self._client = client
        self._url = f"{_GEMINI_BASE}/{model}:generateContent"
        self._timeout = float(getattr(settings, "LLM_TIMEOUT_SECONDS", 120))
        self._max_retries = int(getattr(settings, "LLM_MAX_RETRIES", 3))
        self._max_pdf_mb = float(getattr(settings, "EXTRACTION_MAX_PDF_MB", 18))

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    async def extract_metadata(self, pdf_bytes: bytes) -> ExtractionResult:
        """Extract bibliographic metadata from PDF bytes."""
        from app.llm.base import PDFTooLarge

        # Validate PDF magic bytes
        if not pdf_bytes[:5] == _PDF_HEADER:
            raise PDFTooLarge(
                "Bytes do not start with %PDF-",
                public_message="The file does not appear to be a valid PDF.",
            )

        # Validate size
        size_mb = len(pdf_bytes) / (1024 * 1024)
        if size_mb > self._max_pdf_mb:
            raise PDFTooLarge(
                f"PDF size {size_mb:.1f} MB exceeds limit {self._max_pdf_mb} MB",
                public_message="The manuscript PDF is too large for AI extraction (limit ~18 MB).",
            )

        logger.info(
            "Starting Gemini extraction: model=%s pdf_size_bytes=%d",
            self._model,
            len(pdf_bytes),
        )
        t_start = time.monotonic()

        b64_data = base64.b64encode(pdf_bytes).decode("ascii")

        # First attempt
        raw_text, usage = await self._call_with_retry(b64_data, EXTRACTION_PROMPT)

        # Try parsing; on failure do ONE repair retry
        result = await self._parse_and_maybe_repair(b64_data, raw_text, usage)

        elapsed = time.monotonic() - t_start
        logger.info(
            "Gemini extraction complete: model=%s duration_s=%.2f "
            "prompt_tokens=%d candidates_tokens=%d total_tokens=%d outcome=succeeded",
            self._model,
            elapsed,
            usage.prompt_tokens,
            usage.candidates_tokens,
            usage.total_tokens,
        )
        return result

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_request_body(self, b64_data: str, prompt: str) -> dict[str, Any]:
        return {
            "contents": [
                {
                    "parts": [
                        {
                            "inline_data": {
                                "mime_type": "application/pdf",
                                "data": b64_data,
                            }
                        },
                        {"text": prompt},
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0,
                "responseMimeType": "application/json",
            },
        }

    async def _call_with_retry(
        self,
        b64_data: str,
        prompt: str,
    ) -> tuple[str, TokenUsage]:
        """
        POST to Gemini with exponential back-off retry on 429/5xx/timeout.

        Returns (response_text, token_usage).
        Raises LLMQuotaExceeded, LLMUnavailable, or LLMConfigError as appropriate.
        """
        last_exc: Exception | None = None
        for attempt in range(self._max_retries + 1):
            wait = self._backoff_seconds(attempt)
            if attempt > 0:
                logger.info(
                    "Gemini retry attempt=%d wait_s=%.2f",
                    attempt,
                    wait,
                )
                await self._sleep(wait)

            try:
                resp = await self._client.post(
                    self._url,
                    headers={"x-goog-api-key": self._key},
                    json=self._build_request_body(b64_data, prompt),
                    timeout=self._timeout,
                )
            except httpx.TimeoutException as exc:
                logger.warning("Gemini request timeout attempt=%d", attempt)
                last_exc = exc
                continue
            except httpx.RequestError as exc:
                logger.warning("Gemini request error: %s attempt=%d", type(exc).__name__, attempt)
                last_exc = exc
                continue

            status = resp.status_code

            # Hard failures — no retry
            if status in (400, 401, 403):
                raise LLMConfigError(
                    f"Gemini returned HTTP {status}",
                    public_message="AI provider is not properly configured.",
                )

            # Rate limit / quota
            if status == 429:
                body_text = resp.text
                if _DAILY_QUOTA_RE.search(body_text):
                    raise LLMQuotaExceeded(
                        "Gemini daily quota exhausted (HTTP 429)",
                        public_message="AI extraction quota exceeded. Please try again later.",
                    )
                # Transient rate limit — respect Retry-After
                retry_after = self._parse_retry_after(resp)
                if retry_after and attempt < self._max_retries:
                    logger.info(
                        "Gemini 429 rate-limit retry_after_s=%.1f attempt=%d",
                        retry_after,
                        attempt,
                    )
                    await self._sleep(retry_after)
                last_exc = Exception(f"HTTP 429 attempt={attempt}")
                continue

            # Transient server errors
            if status in (500, 503):
                logger.warning("Gemini HTTP %d attempt=%d", status, attempt)
                last_exc = Exception(f"HTTP {status} attempt={attempt}")
                continue

            # Success
            if status == 200:
                return self._parse_response(resp)

            # Other unexpected status
            logger.warning("Gemini unexpected HTTP %d", status)
            last_exc = Exception(f"HTTP {status}")
            continue

        # Exhausted retries
        raise LLMUnavailable(
            f"Gemini unavailable after {self._max_retries} retries: {last_exc}",
            public_message="AI service is temporarily unavailable. Please try again later.",
        )

    def _parse_response(self, resp: httpx.Response) -> tuple[str, TokenUsage]:
        """Extract response text and token usage from a 200 Gemini response."""
        try:
            body = resp.json()
        except Exception:
            return "", TokenUsage()

        usage_meta = body.get("usageMetadata", {})
        usage = TokenUsage(
            prompt_tokens=usage_meta.get("promptTokenCount", 0),
            candidates_tokens=usage_meta.get("candidatesTokenCount", 0),
            total_tokens=usage_meta.get("totalTokenCount", 0),
        )

        try:
            text = body["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError, TypeError):
            return "", usage

        return text, usage

    async def _parse_and_maybe_repair(
        self,
        b64_data: str,
        raw_text: str,
        usage: TokenUsage,
    ) -> ExtractionResult:
        """
        Attempt to parse raw_text into ExtractionResult.
        On failure, do exactly ONE repair retry (same PDF + extra instruction).
        On second failure, raise LLMInvalidResponse.
        """
        result = self._try_parse(raw_text)
        if result is not None:
            return result

        logger.info("Gemini response parse failed; attempting repair retry")
        repair_prompt = EXTRACTION_PROMPT + REPAIR_SUFFIX
        raw_text2, usage2 = await self._call_with_retry(b64_data, repair_prompt)

        # Merge token counts
        usage.prompt_tokens += usage2.prompt_tokens
        usage.candidates_tokens += usage2.candidates_tokens
        usage.total_tokens += usage2.total_tokens

        result = self._try_parse(raw_text2)
        if result is not None:
            return result

        raise LLMInvalidResponse(
            "Gemini returned unparseable JSON after repair retry",
            public_message="AI returned an invalid response. Please retry or contact support.",
        )

    @staticmethod
    def _try_parse(text: str) -> ExtractionResult | None:
        """Try to parse JSON from text, tolerating ```json fences. Returns None on failure."""
        if not text:
            return None

        # Strip ```json fences if present
        fence_match = _JSON_FENCE_RE.search(text)
        json_str = fence_match.group(1).strip() if fence_match else text.strip()

        try:
            data = json.loads(json_str)
        except json.JSONDecodeError:
            return None

        try:
            return ExtractionResult.model_validate(data)
        except Exception:
            return None

    @staticmethod
    def _backoff_seconds(attempt: int) -> float:
        """Exponential backoff with jitter: base 2^attempt seconds ± 20%."""
        base = min(2 ** attempt, 30)
        jitter = random.uniform(-0.2 * base, 0.2 * base)
        return max(0.0, base + jitter)

    @staticmethod
    def _parse_retry_after(resp: httpx.Response) -> float | None:
        """Parse Retry-After header if present (seconds or HTTP-date)."""
        header = resp.headers.get("Retry-After")
        if not header:
            return None
        try:
            return max(0.0, float(header))
        except ValueError:
            # Could be an HTTP-date; fall back to a sensible default
            return 60.0

    @staticmethod
    async def _sleep(seconds: float) -> None:
        """Asyncio sleep; extracted as a method to allow patching in tests."""
        import asyncio

        await asyncio.sleep(seconds)

    @property
    def model(self) -> str:
        return self._model

    @property
    def provider_name(self) -> str:
        return "gemini"


# Make _sleep patchable at the class level in tests
GeminiProvider._sleep = staticmethod(GeminiProvider._sleep)  # type: ignore[method-assign]


def _validate_config(settings: Settings) -> None:
    """Eagerly validate Gemini-specific configuration (call only when the provider is created)."""
    key = settings.GEMINI_API_KEY
    if key is None or not key.get_secret_value().strip():
        raise LLMConfigError(
            "GEMINI_API_KEY must be set to use the Gemini provider",
            public_message="AI provider is not properly configured.",
        )
    if not math.isfinite(float(getattr(settings, "LLM_TIMEOUT_SECONDS", 120))):
        raise LLMConfigError(
            "LLM_TIMEOUT_SECONDS is invalid",
            public_message="AI provider is not properly configured.",
        )
