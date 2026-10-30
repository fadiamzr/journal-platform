"""
PDF validation, metadata stripping, author trace scanning, and chunked upload streaming.
Heavy pypdf CPU-bound operations should run inside thread pools via asyncio.to_thread.
"""

from __future__ import annotations

import io
import logging
import re
import unicodedata
from typing import Any

from fastapi import HTTPException, UploadFile, status
from pypdf import PdfReader, PdfWriter

logger = logging.getLogger(__name__)


class PDFValidationError(HTTPException):
    """User-safe PDF validation error."""

    def __init__(
        self,
        detail: str,
        status_code: int = status.HTTP_422_UNPROCESSABLE_CONTENT,
    ) -> None:
        super().__init__(status_code=status_code, detail=detail)


def validate_pdf(data: bytes, max_mb: int = 50) -> int:
    """
    Validate PDF byte stream:
      - File size cap (<= max_mb)
      - Magic bytes (%PDF-)
      - Parseable structure
      - Not encrypted
      - Page count within 1..500
    Returns total page count on success. Raises PDFValidationError on failure.
    """
    max_bytes = max_mb * 1024 * 1024
    if len(data) > max_bytes:
        raise PDFValidationError(
            f"File size exceeds maximum allowed limit of {max_mb} MB",
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
        )

    if not data.startswith(b"%PDF-"):
        raise PDFValidationError("Invalid file format: not a valid PDF file")

    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as exc:
        logger.warning("PDF parse error: %s", type(exc).__name__)
        raise PDFValidationError("Corrupted or unreadable PDF file") from exc

    try:
        if reader.is_encrypted:
            raise PDFValidationError("Encrypted or password-protected PDF files are not allowed")
    except PDFValidationError:
        raise
    except Exception as exc:
        raise PDFValidationError("Corrupted or unreadable PDF file") from exc

    try:
        num_pages = len(reader.pages)
    except Exception as exc:
        raise PDFValidationError("Corrupted or unreadable PDF file") from exc

    if num_pages < 1:
        raise PDFValidationError("PDF file contains no pages")
    if num_pages > 500:
        raise PDFValidationError("PDF file exceeds maximum limit of 500 pages")

    return num_pages


def strip_metadata(data: bytes) -> bytes:
    """
    Rebuild PDF from pages only, discarding document metadata, Info dictionary,
    XMP packets, attachments, and document-level actions/JavaScript.
    """
    reader = PdfReader(io.BytesIO(data))
    writer = PdfWriter()

    for page in reader.pages:
        writer.add_page(page)

    # Clean catalog and document root
    root = writer._root_object
    for key in ["/Metadata", "/Names", "/OpenAction", "/AA", "/AcroForm", "/PieceInfo"]:
        if key in root:
            del root[key]

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


def _normalize_search_string(text: str) -> str:
    """Remove accents, strip whitespace, and convert to lowercase ASCII."""
    nfkd = unicodedata.normalize("NFKD", text)
    stripped = "".join(c for c in nfkd if not unicodedata.combining(c))
    return stripped.lower().strip()


def find_author_traces(
    data: bytes,
    names: list[str],
    emails: list[str],
) -> list[dict[str, Any]]:
    """
    Best-effort scan of PDF pages for author names and emails.
    Case-insensitive, accent-insensitive, ignores tokens shorter than 4 characters.
    Tolerates extraction failures and NEVER returns matched text.
    """
    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception:
        return []

    # Compile search tokens
    email_tokens: set[str] = set()
    for email in emails:
        norm_email = _normalize_search_string(email)
        # Require that the email has word tokens with at least 4 characters
        words = [w for w in re.findall(r"\w+", norm_email) if len(w) >= 4]
        if words:
            email_tokens.add(norm_email)

    name_tokens: set[str] = set()
    for name in names:
        norm_name = _normalize_search_string(name)
        # Tokenize by words for names; ignore tokens shorter than 4 characters
        for word in re.findall(r"\w+", norm_name):
            if len(word) >= 4:
                name_tokens.add(word)

    traces: list[dict[str, Any]] = []

    for page_idx, page in enumerate(reader.pages):
        page_num = page_idx + 1
        try:
            page_text = page.extract_text() or ""
        except Exception:
            page_text = ""

        if not page_text:
            continue

        norm_page = _normalize_search_string(page_text)

        # Check emails first
        if any(token in norm_page for token in email_tokens):
            traces.append({"type": "author_email", "page": page_num})

        # Check names
        if any(token in norm_page for token in name_tokens):
            traces.append({"type": "author_name", "page": page_num})

    return traces


async def read_upload_stream(upload_file: UploadFile, max_mb: int = 50) -> bytes:
    """
    Read multipart upload file in 64 KB chunks, aborting immediately if size limit is exceeded.
    Ignores client-supplied filename completely.
    """
    max_bytes = max_mb * 1024 * 1024
    content = bytearray()
    chunk_size = 64 * 1024

    while True:
        chunk = await upload_file.read(chunk_size)
        if not chunk:
            break
        content.extend(chunk)
        if len(content) > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                detail=f"Upload size exceeds maximum allowed limit of {max_mb} MB",
            )

    return bytes(content)
