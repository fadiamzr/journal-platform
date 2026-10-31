"""
Stub Anthropic provider.

Intended design: use the Anthropic Messages API with a Claude model that
supports PDF document blocks. Send the PDF as a document block (type="document",
source.type="base64", source.media_type="application/pdf") alongside the
EXTRACTION_PROMPT as a text block. Parse the model's JSON response with
ExtractionResult. This is the cleanest path for academic PDFs because Claude
can read the document structure natively.

Not yet implemented in Phase 5 — raises LLMConfigError immediately.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.llm.base import LLMConfigError
from app.llm.schemas import ExtractionResult

if TYPE_CHECKING:
    import httpx

    from app.core.config import Settings


class AnthropicProvider:
    """
    Stub Anthropic Claude provider (not yet implemented).

    To implement:
    1. POST to https://api.anthropic.com/v1/messages with:
       - model: claude-3-5-sonnet (or configurable via ANTHROPIC_MODEL).
       - content: [{"type": "document", "source": {"type": "base64",
           "media_type": "application/pdf", "data": <b64>}},
           {"type": "text", "text": EXTRACTION_PROMPT}]
       - headers: x-api-key, anthropic-version, anthropic-beta: pdfs-2024-09-25
    2. Parse the text from content[0].text.
    3. Validate with ExtractionResult.
    """

    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:  # noqa: ARG002
        raise LLMConfigError(
            "Anthropic provider not implemented yet in this phase",
            public_message="AI provider is not properly configured.",
        )

    async def extract_metadata(self, pdf_bytes: bytes) -> ExtractionResult:  # pragma: no cover
        raise LLMConfigError(
            "Anthropic provider not implemented yet in this phase",
            public_message="AI provider is not properly configured.",
        )
