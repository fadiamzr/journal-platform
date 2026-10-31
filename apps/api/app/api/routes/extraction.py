"""
Extraction API routes.

POST /submissions/{submission_id}/extract
    - 202 {"status": "pending"} on success
    - 401 without a valid token
    - 404 if submission does not exist or caller is not allowed to see it
    - 409 if not a draft or an extraction is already running
    - 503 if the provider is not configured

GET /submissions/{submission_id}/extraction
    - {"status", "error", "language", "title", "abstract", "keywords", "authors"}
    - 401 / 404 rules same as POST
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status

from app.clients.supabase_admin import SupabaseAdminClient, get_supabase_admin
from app.core.config import Settings, get_settings
from app.core.deps import Role, get_current_user
from app.core.security import AuthenticatedUser
from app.llm import factory as llm_factory
from app.llm.base import LLMConfigError
from app.llm.limiter import ExtractionLimiter
from app.services.extraction import ExtractionService

logger = logging.getLogger(__name__)

router = APIRouter(tags=["extraction"])

# Stale pending run threshold in minutes
_STALE_MINUTES = 10

# Module-level shared limiter; replaced in tests via ExtractionLimiter injection
_limiter = ExtractionLimiter(max_concurrent=2, max_rpm=10)


def _stale_before_iso() -> str:
    """ISO 8601 timestamp for 10 minutes ago (UTC)."""
    dt = datetime.now(UTC) - timedelta(minutes=_STALE_MINUTES)
    return dt.isoformat()


def _caller_may_access(submission: dict[str, Any], user: AuthenticatedUser) -> bool:
    """Return True if the user is the submission author, an editor, or an admin."""
    if user.user_role in (Role.EDITOR, Role.ADMIN):
        return True
    return str(submission.get("author_id", "")) == user.user_id


async def _get_accessible_submission(
    submission_id: str,
    user: AuthenticatedUser,
    admin: SupabaseAdminClient,
) -> dict[str, Any]:
    """
    Load the submission and verify the caller may access it.
    Raises HTTP 404 (same body as not found) if it does not exist or the
    caller is neither its author nor an editor/admin.
    This prevents leaking whether a submission exists to unauthorized callers.
    """
    submission = await admin.get_submission(submission_id)
    if submission is None or not _caller_may_access(submission, user):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="submission not found",
        )
    return submission


@router.post("/submissions/{submission_id}/extract", status_code=status.HTTP_202_ACCEPTED)
async def start_extraction(
    submission_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    admin: SupabaseAdminClient = Depends(get_supabase_admin),
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    """
    Trigger AI metadata extraction for a submission.

    Validates the submission exists, the caller is authorized, and the submission
    is in the draft status.  Claims the extraction slot atomically, then schedules
    the extraction as a background task.
    """
    sid = str(submission_id)
    submission = await _get_accessible_submission(sid, user, admin)

    # Check status gate
    if submission.get("status") != "draft":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Extraction is only available for draft submissions.",
        )

    # Check for an already-running (non-stale) extraction
    ext_status = submission.get("extraction_status")
    if ext_status == "pending":
        # The route itself doesn't know if it's stale yet — let claim_extraction decide
        pass

    # Attempt to claim (atomic conditional PATCH)
    stale_iso = _stale_before_iso()
    claimed = await admin.claim_extraction(sid, stale_iso)
    if claimed is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "An extraction is already running for this submission. "
                "It will be re-claimable after 10 minutes of inactivity."
            ),
        )

    # Instantiate the provider (may raise LLMConfigError if not configured)
    http_client = getattr(request.app.state, "http_client", None)
    try:
        provider = llm_factory.get_provider(settings, http_client)
    except LLMConfigError as exc:
        # Undo the claim so the submission is not stuck in pending
        await admin.update_submission(sid, {"extraction_status": "not_started"})
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=exc.public_message,
        ) from exc

    service = ExtractionService(admin=admin, provider=provider, limiter=_limiter)  # type: ignore[arg-type]
    background_tasks.add_task(service.run, sid)

    logger.info("extraction.scheduled submission_id=%s user_id=%s", sid, user.user_id)
    return {"status": "pending"}


@router.get("/submissions/{submission_id}/extraction")
async def get_extraction_status(
    submission_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    admin: SupabaseAdminClient = Depends(get_supabase_admin),
) -> dict[str, Any]:
    """
    Return the current extraction status for a submission.

    Reads directly from the database (never from in-process memory).
    Only the submission author, editors, and admins may call this.
    """
    sid = str(submission_id)
    submission = await _get_accessible_submission(sid, user, admin)

    # Fetch authors if extraction succeeded
    authors: list[dict[str, Any]] = []
    if submission.get("extraction_status") == "succeeded":
        raw_authors = await admin.list_authors(sid)
        authors = [
            {
                "full_name": a.get("full_name"),
                "email": a.get("email"),
                "orcid": a.get("orcid"),
                "affiliation": a.get("affiliation"),
                "is_corresponding": a.get("is_corresponding", False),
                "position": a.get("position"),
            }
            for a in raw_authors
        ]

    return {
        "status": submission.get("extraction_status", "not_started"),
        "error": submission.get("extraction_error"),
        "language": submission.get("manuscript_language"),
        "title": submission.get("title") or {},
        "abstract": submission.get("abstract") or {},
        "keywords": submission.get("keywords") or {},
        "authors": authors,
    }
