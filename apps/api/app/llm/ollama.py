"""
Stub Ollama provider.

Intended design: render each PDF page to an image (e.g., with pypdfium2 or
pdf2image), send the page images to a local Ollama vision model such as
llava or bakllava via the Ollama /api/generate endpoint, collect JSON
responses per page, and merge them into a single ExtractionResult.
This avoids corrupted Arabic text layers by going through the vision path.

Not yet implemented in Phase 5 — raises LLMConfigError immediately.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from app.llm.base import LLMConfigError
from app.llm.schemas import ExtractionResult

if TYPE_CHECKING:
    import httpx

    from app.core.config import Settings


class OllamaProvider:
    """
    Stub Ollama local-model provider (not yet implemented).

    To implement:
    1. Render PDF pages to JPEG/PNG images (pypdfium2 or pdf2image).
    2. For each page, POST to http://<OLLAMA_HOST>/api/generate with a vision
       model (e.g. llava), sending the image as base64.
    3. Instruct the model to extract only the JSON schema from EXTRACTION_PROMPT.
    4. Merge per-page results and validate with ExtractionResult.
    """

    def __init__(self, settings: Settings, client: httpx.AsyncClient) -> None:  # noqa: ARG002
        raise LLMConfigError(
            "Ollama provider not implemented yet in this phase",
            public_message="AI provider is not properly configured.",
        )

    async def extract_metadata(self, pdf_bytes: bytes) -> ExtractionResult:  # pragma: no cover
        raise LLMConfigError(
            "Ollama provider not implemented yet in this phase",
            public_message="AI provider is not properly configured.",
        )
