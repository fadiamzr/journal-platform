"""
Unit tests for PDF services: validation, metadata stripping, author trace detection,
and upload stream reader.
"""

from __future__ import annotations

import io
from unittest.mock import AsyncMock

import pytest
from fastapi import HTTPException
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject, create_string_object

from app.services.metadata import normalize_abstract, normalize_keywords, normalize_title
from app.services.pdf import (
    PDFValidationError,
    find_author_traces,
    read_upload_stream,
    strip_metadata,
    validate_pdf,
)


def _create_pdf(
    num_pages: int = 1,
    metadata: dict[str, str] | None = None,
    text: str | None = None,
    encrypt_pwd: str | None = None,
    with_attachment: bool = False,
) -> bytes:
    """Generate in-memory PDF without network or disk files."""
    writer = PdfWriter()
    for _ in range(num_pages):
        page = writer.add_blank_page(width=200, height=200)
        if text:
            font_dict = DictionaryObject({
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            })
            fonts = DictionaryObject({NameObject("/F1"): font_dict})
            page[NameObject("/Resources")] = DictionaryObject({NameObject("/Font"): fonts})
            content = f"BT /F1 12 Tf 20 100 Td ({text}) Tj ET".encode("latin-1", errors="ignore")
            stream = DecodedStreamObject()
            stream.set_data(content)
            page[NameObject("/Contents")] = stream

    if metadata:
        writer.add_metadata(
            {NameObject(f"/{k}"): create_string_object(v) for k, v in metadata.items()}
        )
    if with_attachment:
        writer.add_attachment("test.txt", b"attachment data")
    if encrypt_pwd:
        writer.encrypt(encrypt_pwd)

    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


# ---------------------------------------------------------------------------
# PDF Validation Tests
# ---------------------------------------------------------------------------


def test_validate_pdf_valid():
    data = _create_pdf(num_pages=3)
    pages = validate_pdf(data, max_mb=50)
    assert pages == 3


def test_validate_pdf_not_a_pdf():
    with pytest.raises(PDFValidationError, match="not a valid PDF file"):
        validate_pdf(b"Not a PDF file", max_mb=50)


def test_validate_pdf_corrupted():
    corrupted = b"%PDF-1.4 completely corrupted binary content that cannot be parsed"
    with pytest.raises(PDFValidationError, match="Corrupted or unreadable"):
        validate_pdf(corrupted, max_mb=50)


def test_validate_pdf_too_large():
    data = _create_pdf(num_pages=1)
    with pytest.raises(PDFValidationError, match="exceeds maximum allowed limit"):
        validate_pdf(data, max_mb=0)  # max 0 MB


def test_validate_pdf_encrypted():
    data = _create_pdf(num_pages=1, encrypt_pwd="password123")
    with pytest.raises(PDFValidationError, match="Encrypted or password-protected"):
        validate_pdf(data, max_mb=50)


def test_validate_pdf_zero_pages():
    writer = PdfWriter()
    out = io.BytesIO()
    writer.write(out)
    empty_pdf = out.getvalue()
    with pytest.raises(PDFValidationError, match="contains no pages"):
        validate_pdf(empty_pdf, max_mb=50)


def test_validate_pdf_too_many_pages():
    data = _create_pdf(num_pages=501)
    with pytest.raises(PDFValidationError, match="exceeds maximum limit of 500 pages"):
        validate_pdf(data, max_mb=50)


# ---------------------------------------------------------------------------
# Metadata Stripping Tests
# ---------------------------------------------------------------------------


def test_strip_metadata_removes_info_and_attachments():
    original = _create_pdf(
        num_pages=2,
        metadata={"Author": "Dr. Hidden Author", "Title": "Secret Title"},
        with_attachment=True,
    )

    orig_reader = PdfReader(io.BytesIO(original))
    assert orig_reader.metadata is not None
    assert orig_reader.metadata.author == "Dr. Hidden Author"
    assert len(orig_reader.attachments) > 0

    stripped = strip_metadata(original)
    clean_reader = PdfReader(io.BytesIO(stripped))

    assert len(clean_reader.pages) == 2
    # Verify metadata is stripped
    if clean_reader.metadata is not None:
        assert clean_reader.metadata.author is None
        assert clean_reader.metadata.title is None
    assert clean_reader.xmp_metadata is None
    assert len(clean_reader.attachments) == 0


# ---------------------------------------------------------------------------
# Author Trace Detection Tests
# ---------------------------------------------------------------------------


def test_find_author_traces_accented_and_uppercase():
    text = "Research conducted by RENE HEBERT and email rene.hebert@test.local"
    pdf_bytes = _create_pdf(num_pages=1, text=text)

    # Search with accents / different casing
    names = ["René Hébert"]
    emails = ["rene.hebert@test.local"]

    traces = find_author_traces(pdf_bytes, names, emails)
    assert len(traces) == 2
    types = {t["type"] for t in traces}
    assert "author_name" in types
    assert "author_email" in types
    for t in traces:
        assert t["page"] == 1
        # MUST NEVER expose matched text
        assert "text" not in t
        assert "matched" not in t


def test_find_author_traces_ignores_short_tokens():
    text = "Short name Ali Li with email a@b.c"
    pdf_bytes = _create_pdf(num_pages=1, text=text)

    # All tokens are < 4 chars
    names = ["Ali Li"]
    emails = ["a@b.c"]

    traces = find_author_traces(pdf_bytes, names, emails)
    assert traces == []


# ---------------------------------------------------------------------------
# Stream Upload Chunking Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_read_upload_stream_aborts_early():
    mock_file = AsyncMock()
    # Provide chunks of 64KB
    chunk = b"X" * (64 * 1024)
    # 20 chunks = 1.25 MB
    mock_file.read.side_effect = [chunk] * 20 + [b""]

    # Cap at 1 MB
    with pytest.raises(HTTPException) as exc_info:
        await read_upload_stream(mock_file, max_mb=1)
    assert exc_info.value.status_code == 413
    assert "Upload size exceeds" in exc_info.value.detail


# ---------------------------------------------------------------------------
# Metadata Normalization Tests
# ---------------------------------------------------------------------------


def test_metadata_normalization():
    norm_title = normalize_title({"en": "  My Paper  ", "fr": "Mon Papier"})
    assert norm_title == {"en": "My Paper", "fr": "Mon Papier"}

    norm_abstract = normalize_abstract({"en": " Abstract text "})
    assert norm_abstract == {"en": "Abstract text"}

    norm_kw = normalize_keywords({"en": [" ML ", "", " AI "]})
    assert norm_kw == {"en": ["ML", "AI"]}

    # Invalid language
    with pytest.raises(Exception):
        normalize_title({"de": "Ungültig"})
