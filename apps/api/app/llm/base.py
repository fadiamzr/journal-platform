"""
LLM provider base protocol and exception hierarchy.

Each exception exposes a `public_message` that is safe to expose to API callers:
it must never contain document text, API keys, or internal stack details.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.llm.schemas import ExtractionResult

# ---------------------------------------------------------------------------
# Exception hierarchy
# ---------------------------------------------------------------------------


class LLMError(Exception):
    """Base class for all LLM provider errors."""

    public_message: str = "An error occurred during AI metadata extraction."

    def __init__(self, message: str = "", *, public_message: str | None = None) -> None:
        super().__init__(message)
        if public_message is not None:
            self.public_message = public_message


class LLMQuotaExceeded(LLMError):
    """Raised when a daily/per-minute quota limit has been exhausted."""

    public_message = "AI extraction quota exceeded. Please try again later."


class LLMUnavailable(LLMError):
    """Raised when the LLM provider is unreachable or persistently returning 5xx errors."""

    public_message = "AI service is temporarily unavailable. Please try again later."


class LLMInvalidResponse(LLMError):
    """Raised when the LLM response cannot be parsed or validated as ExtractionResult."""

    public_message = "AI returned an invalid response. Please retry or contact support."


class LLMConfigError(LLMError):
    """Raised for configuration problems (missing key, unknown provider, etc.)."""

    public_message = "AI provider is not properly configured."


class PDFTooLarge(LLMError):
    """Raised when the PDF exceeds the provider's inline data size limit."""

    public_message = "The manuscript PDF is too large for AI extraction (limit ~18 MB)."


# ---------------------------------------------------------------------------
# Provider protocol
# ---------------------------------------------------------------------------


@runtime_checkable
class LLMProvider(Protocol):
    """
    Abstract interface that every LLM backend must implement.

    Implementations are responsible for:
    - Accepting raw PDF bytes (validated to be a real PDF).
    - Sending the PDF to the underlying model.
    - Returning a validated ExtractionResult.
    - Raising LLMError subclasses on any error condition.
    """

    async def extract_metadata(self, pdf_bytes: bytes) -> ExtractionResult:
        """
        Extract bibliographic metadata from the supplied PDF bytes.

        Args:
            pdf_bytes: Raw bytes of a valid PDF document.

        Returns:
            Validated ExtractionResult with normalized fields.

        Raises:
            PDFTooLarge: PDF exceeds the size limit.
            LLMQuotaExceeded: Daily or per-minute quota exhausted.
            LLMUnavailable: Provider persistently unreachable.
            LLMInvalidResponse: Cannot parse or validate provider output.
            LLMConfigError: Provider mis-configured.
            LLMError: Any other provider-level error.
        """
        ...
