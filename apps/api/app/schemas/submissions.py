"""
Pydantic schemas for submission lifecycle, metadata, versions, and authors.
Request models enforce extra='forbid'.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class VersionInfo(BaseModel):
    """Summary of a submission revision round version."""

    round: int
    has_manuscript: bool
    has_blind_copy: bool
    blind_copy_verified: bool
    file_size_bytes: int | None = None
    review_note: str | None = None
    response_to_reviewers: str | None = None
    created_at: datetime | str | None = None


class StatusEvent(BaseModel):
    """Audit log status transition event."""

    from_status: str | None = None
    to_status: str
    at: datetime | str


class AuthorResponse(BaseModel):
    """Declared author metadata returned in submission detail."""

    position: int
    full_name: str
    affiliations: list[str] = Field(default_factory=list)
    email: str | None = None
    orcid: str | None = None
    is_corresponding: bool = False


class SubmissionSummary(BaseModel):
    """High-level summary of a submission for listing endpoints."""

    id: str
    status: str
    manuscript_language: str
    title: dict[str, str] = Field(default_factory=dict)
    abstract: dict[str, str] = Field(default_factory=dict)
    keywords: dict[str, list[str]] = Field(default_factory=dict)
    current_round: int
    created_at: datetime | str
    updated_at: datetime | str


class SubmissionDetail(BaseModel):
    """Full detail of a submission."""

    id: str
    author_id: str | None = None
    status: str
    manuscript_language: str
    title: dict[str, str] = Field(default_factory=dict)
    abstract: dict[str, str] = Field(default_factory=dict)
    keywords: dict[str, list[str]] = Field(default_factory=dict)
    current_round: int
    extraction_status: str = "not_started"
    authors: list[AuthorResponse] = Field(default_factory=list)
    versions: list[VersionInfo] = Field(default_factory=list)
    status_history: list[StatusEvent] = Field(default_factory=list)
    created_at: datetime | str
    updated_at: datetime | str


# ---------------------------------------------------------------------------
# Request Models (extra="forbid")
# ---------------------------------------------------------------------------


class CreateSubmissionRequest(BaseModel):
    """Draft creation request."""

    model_config = ConfigDict(extra="forbid")

    manuscript_language: str = "en"


class UpdateMetadataRequest(BaseModel):
    """Metadata update request for title, abstract, keywords, and language."""

    model_config = ConfigDict(extra="forbid")

    language: str | None = None
    title: dict[str, str] | None = None
    abstract: dict[str, str] | None = None
    keywords: dict[str, list[str]] | None = None


class AuthorInput(BaseModel):
    """Input representation of an author."""

    model_config = ConfigDict(extra="forbid")

    full_name: str = Field(..., min_length=1)
    affiliations: list[str] = Field(default_factory=list)
    email: str | None = None
    orcid: str | None = None
    is_corresponding: bool = False


class UpdateAuthorsRequest(BaseModel):
    """Author list replacement request (max 50 authors)."""

    model_config = ConfigDict(extra="forbid")

    authors: list[AuthorInput] = Field(..., max_length=50)


class SubmitRequest(BaseModel):
    """Submission finalize request."""

    model_config = ConfigDict(extra="forbid")

    response_to_reviewers: str | None = None


class RejectBlindCopyRequest(BaseModel):
    """Editor rejection feedback note for blind copy."""

    model_config = ConfigDict(extra="forbid")

    note: str = Field(..., min_length=1, max_length=1000)


class FileDownloadResponse(BaseModel):
    """Temporary signed URL response for file download."""

    url: str
    expires_in: int


class FileUploadResponse(BaseModel):
    """Response returned after uploading manuscript or blind copy."""

    round: int
    size: int
    warnings: list[dict[str, Any]] | None = None
