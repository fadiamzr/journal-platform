"""
Submissions lifecycle, author metadata, file uploads, and blind-copy verification routes.
Enforces author ownership, editor/admin conflict-of-interest checks, and PostgREST RLS.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status

from app.clients.supabase_admin import SupabaseAdminClient, get_supabase_admin
from app.clients.supabase_user import SupabaseUserClient, get_user_client
from app.core.config import Settings, get_settings
from app.core.deps import Role, get_current_user, require_roles
from app.core.security import AuthenticatedUser
from app.schemas.submissions import (
    AuthorResponse,
    CreateSubmissionRequest,
    FileDownloadResponse,
    FileUploadResponse,
    RejectBlindCopyRequest,
    StatusEvent,
    SubmissionDetail,
    SubmissionSummary,
    SubmitRequest,
    UpdateAuthorsRequest,
    UpdateMetadataRequest,
    VersionInfo,
)
from app.services.metadata import (
    ALLOWED_LOCALES,
    normalize_abstract,
    normalize_keywords,
    normalize_title,
)
from app.services.pdf import find_author_traces, read_upload_stream, strip_metadata, validate_pdf

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/submissions", tags=["submissions"])


# ---------------------------------------------------------------------------
# Author / Owner Endpoints
# ---------------------------------------------------------------------------


@router.post("", status_code=status.HTTP_201_CREATED, response_model=SubmissionSummary)
async def create_draft_submission(
    body: CreateSubmissionRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    user_client: SupabaseUserClient = Depends(get_user_client),
) -> SubmissionSummary:
    """Create a new manuscript submission in draft status."""
    lang = body.manuscript_language.lower().strip()
    locales_str = ", ".join(sorted(ALLOWED_LOCALES))
    if lang not in ALLOWED_LOCALES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Invalid manuscript language '{lang}'; must be one of {locales_str}",
        )

    draft_data = {
        "author_id": user.user_id,
        "manuscript_language": lang,
        "title": {},
        "abstract": {},
        "keywords": {},
        "status": "draft",
    }

    rows = await user_client.insert("submissions", draft_data, return_representation=True)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Failed to create draft submission",
        )

    row = rows[0]
    logger.info("Created draft submission %s for author %s", row["id"], user.user_id)
    return SubmissionSummary(
        id=str(row["id"]),
        status=row["status"],
        manuscript_language=row["manuscript_language"],
        title=row.get("title") or {},
        abstract=row.get("abstract") or {},
        keywords=row.get("keywords") or {},
        current_round=row.get("current_round", 1),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("", response_model=list[SubmissionSummary])
async def list_submissions(
    status_filter: str | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user_client: SupabaseUserClient = Depends(get_user_client),
) -> list[SubmissionSummary]:
    """
    List submissions visible to the caller.
    Authors see only own submissions (RLS-enforced); editors/admins see all.
    """
    params: dict[str, Any] = {
        "limit": str(limit),
        "offset": str(offset),
        "order": "created_at.desc",
        "select": "*",
    }
    if status_filter:
        params["status"] = f"eq.{status_filter.strip()}"

    rows = await user_client.select("submissions", params=params)
    summaries: list[SubmissionSummary] = []
    for r in rows:
        summaries.append(
            SubmissionSummary(
                id=str(r["id"]),
                status=r["status"],
                manuscript_language=r["manuscript_language"],
                title=r.get("title") or {},
                abstract=r.get("abstract") or {},
                keywords=r.get("keywords") or {},
                current_round=r.get("current_round", 1),
                created_at=r["created_at"],
                updated_at=r["updated_at"],
            )
        )
    return summaries


@router.get("/{submission_id}", response_model=SubmissionDetail)
async def get_submission_detail(
    submission_id: uuid.UUID,
    user: AuthenticatedUser = Depends(get_current_user),
    user_client: SupabaseUserClient = Depends(get_user_client),
    admin_client: SupabaseAdminClient = Depends(get_supabase_admin),
) -> SubmissionDetail:
    """
    Fetch full detail of a submission including authors, versions summary, and status history.
    Excludes storage paths. 404 for callers who are neither the author nor an editor/admin.
    """
    sub_id_str = str(submission_id)
    rows = await user_client.select("submissions", params={"id": f"eq.{sub_id_str}", "select": "*"})
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )
    sub = rows[0]

    # Fetch declared authors
    raw_authors = await admin_client.get_authors(sub_id_str)
    authors: list[AuthorResponse] = []
    is_privileged = user.user_role in (Role.EDITOR, Role.ADMIN)
    is_owner = sub["author_id"] == user.user_id

    for a in raw_authors:
        raw_aff = a.get("affiliation") or ""
        affiliations = [aff.strip() for aff in raw_aff.split(";") if aff.strip()]
        email = a.get("email") if (is_privileged or is_owner) else None
        authors.append(
            AuthorResponse(
                position=a["position"],
                full_name=a["full_name"],
                affiliations=affiliations,
                email=email,
                orcid=a.get("orcid"),
                is_corresponding=a.get("is_corresponding", False),
            )
        )

    # Fetch version records
    v_rows = await user_client.select(
        "submission_versions",
        params={"submission_id": f"eq.{sub_id_str}", "order": "round.asc", "select": "*"},
    )
    versions: list[VersionInfo] = []
    for v in v_rows:
        versions.append(
            VersionInfo(
                round=v["round"],
                has_manuscript=bool(v.get("manuscript_path")),
                has_blind_copy=bool(v.get("anonymized_path")),
                blind_copy_verified=bool(v.get("anonymized_verified_at")),
                file_size_bytes=v.get("file_size_bytes"),
                review_note=v.get("anonymized_review_note"),
                response_to_reviewers=v.get("response_to_reviewers"),
                created_at=v.get("created_at"),
            )
        )

    # Fetch status history
    h_rows = await user_client.select(
        "submission_status_history",
        params={"submission_id": f"eq.{sub_id_str}", "order": "changed_at.asc", "select": "*"},
    )
    status_history = [
        StatusEvent(
            from_status=h.get("from_status"),
            to_status=h["to_status"],
            at=h["changed_at"],
        )
        for h in h_rows
    ]

    return SubmissionDetail(
        id=sub_id_str,
        author_id=sub["author_id"] if (is_privileged or is_owner) else None,
        status=sub["status"],
        manuscript_language=sub["manuscript_language"],
        title=sub.get("title") or {},
        abstract=sub.get("abstract") or {},
        keywords=sub.get("keywords") or {},
        current_round=sub.get("current_round", 1),
        extraction_status=sub.get("extraction_status", "not_started"),
        authors=authors,
        versions=versions,
        status_history=status_history,
        created_at=sub["created_at"],
        updated_at=sub["updated_at"],
    )


@router.put("/{submission_id}/metadata", response_model=SubmissionSummary)
async def update_metadata(
    submission_id: uuid.UUID,
    body: UpdateMetadataRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    user_client: SupabaseUserClient = Depends(get_user_client),
) -> SubmissionSummary:
    """Update multilingual metadata. Allowed only when status is draft or revisions_requested."""
    sub_id_str = str(submission_id)
    rows = await user_client.select("submissions", params={"id": f"eq.{sub_id_str}", "select": "*"})
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    sub = rows[0]

    if sub["status"] not in ("draft", "revisions_requested"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot edit metadata when submission is in status '{sub['status']}'",
        )
    if sub["author_id"] != user.user_id and user.user_role not in (Role.EDITOR, Role.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden: not owner")

    update_payload: dict[str, Any] = {}
    if body.language is not None:
        lang = body.language.lower().strip()
        if lang not in ALLOWED_LOCALES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Invalid language code '{lang}'; must be one of {sorted(ALLOWED_LOCALES)}",
            )
        update_payload["manuscript_language"] = lang
    if body.title is not None:
        update_payload["title"] = normalize_title(body.title)
    if body.abstract is not None:
        update_payload["abstract"] = normalize_abstract(body.abstract)
    if body.keywords is not None:
        update_payload["keywords"] = normalize_keywords(body.keywords)

    if not update_payload:
        return SubmissionSummary(
            id=sub_id_str,
            status=sub["status"],
            manuscript_language=sub["manuscript_language"],
            title=sub.get("title") or {},
            abstract=sub.get("abstract") or {},
            keywords=sub.get("keywords") or {},
            current_round=sub.get("current_round", 1),
            created_at=sub["created_at"],
            updated_at=sub["updated_at"],
        )

    updated_rows = await user_client.update(
        "submissions",
        update_payload,
        params={"id": f"eq.{sub_id_str}"},
        return_representation=True,
    )
    res = updated_rows[0] if updated_rows else sub
    return SubmissionSummary(
        id=sub_id_str,
        status=res["status"],
        manuscript_language=res["manuscript_language"],
        title=res.get("title") or {},
        abstract=res.get("abstract") or {},
        keywords=res.get("keywords") or {},
        current_round=res.get("current_round", 1),
        created_at=res["created_at"],
        updated_at=res["updated_at"],
    )


@router.put("/{submission_id}/authors", response_model=list[AuthorResponse])
async def update_authors(
    submission_id: uuid.UUID,
    body: UpdateAuthorsRequest,
    user: AuthenticatedUser = Depends(get_current_user),
    user_client: SupabaseUserClient = Depends(get_user_client),
) -> list[AuthorResponse]:
    """Replace declared author list. Allowed only when status is draft or revisions_requested."""
    sub_id_str = str(submission_id)
    rows = await user_client.select("submissions", params={"id": f"eq.{sub_id_str}", "select": "*"})
    if not rows:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")
    sub = rows[0]

    if sub["status"] not in ("draft", "revisions_requested"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot edit authors when submission is in status '{sub['status']}'",
        )
    if sub["author_id"] != user.user_id and user.user_role not in (Role.EDITOR, Role.ADMIN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="forbidden: not owner")

    # Clear existing author list
    await user_client.delete("submission_authors", params={"submission_id": f"eq.{sub_id_str}"})

    new_author_rows: list[dict[str, Any]] = []
    for idx, a in enumerate(body.authors, start=1):
        affiliation_str = "; ".join(a.affiliations) if a.affiliations else None
        new_author_rows.append(
            {
                "submission_id": sub_id_str,
                "position": idx,
                "full_name": a.full_name,
                "email": a.email,
                "affiliation": affiliation_str,
                "orcid": a.orcid,
                "is_corresponding": a.is_corresponding,
            }
        )

    if new_author_rows:
        inserted = await user_client.insert("submission_authors", new_author_rows)
    else:
        inserted = []

    res_authors: list[AuthorResponse] = []
    for row in inserted:
        affs = [item.strip() for item in (row.get("affiliation") or "").split(";") if item.strip()]
        res_authors.append(
            AuthorResponse(
                position=row["position"],
                full_name=row["full_name"],
                affiliations=affs,
                email=row.get("email"),
                orcid=row.get("orcid"),
                is_corresponding=row.get("is_corresponding", False),
            )
        )
    return res_authors


@router.post("/{submission_id}/manuscript", response_model=FileUploadResponse)
async def upload_manuscript(
    submission_id: uuid.UUID,
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    admin_client: SupabaseAdminClient = Depends(get_supabase_admin),
) -> FileUploadResponse:
    """
    Upload full manuscript PDF (with author names).
    Allowed only for author when status is draft or revisions_requested.
    """
    sub_id_str = str(submission_id)
    sub = await admin_client.get_submission(sub_id_str)
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if sub["author_id"] != user.user_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found",
        )

    if sub["status"] not in ("draft", "revisions_requested"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot upload manuscript when submission is in status '{sub['status']}'",
        )

    target_round = sub["current_round"] if sub["status"] == "draft" else sub["current_round"] + 1

    pdf_bytes = await read_upload_stream(file, max_mb=settings.MAX_UPLOAD_MB)
    await asyncio.to_thread(validate_pdf, pdf_bytes, settings.MAX_UPLOAD_MB)

    storage_path = f"{user.user_id}/{sub_id_str}/v{target_round}.pdf"
    await admin_client.upload_object("manuscripts", storage_path, pdf_bytes, "application/pdf")

    version_record = {
        "submission_id": sub_id_str,
        "round": target_round,
        "manuscript_path": storage_path,
        "file_size_bytes": len(pdf_bytes),
        "uploaded_by": user.user_id,
    }
    await admin_client.upsert_version_row(version_record)
    logger.info(
        "Uploaded manuscript for %s round %d (%d bytes)",
        sub_id_str,
        target_round,
        len(pdf_bytes),
    )
    return FileUploadResponse(round=target_round, size=len(pdf_bytes))


@router.post("/{submission_id}/blind-copy", response_model=FileUploadResponse)
async def upload_blind_copy(
    submission_id: uuid.UUID,
    file: UploadFile = File(...),
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    admin_client: SupabaseAdminClient = Depends(get_supabase_admin),
) -> FileUploadResponse:
    """
    Upload blind copy PDF with names stripped.
    Allowed for author (draft, revisions_requested, or submitted with unverified blind copy)
    and editor/admin (submitted and unverified).
    """
    sub_id_str = str(submission_id)
    sub = await admin_client.get_submission(sub_id_str)
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    is_author = sub["author_id"] == user.user_id
    is_editor = user.user_role in (Role.EDITOR, Role.ADMIN)

    if not (is_author or is_editor):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if sub["status"] == "revisions_requested":
        target_round = sub["current_round"] + 1
    else:
        target_round = sub["current_round"]
    current_version = await admin_client.get_version_row(sub_id_str, sub["current_round"])
    is_verified = bool(current_version and current_version.get("anonymized_verified_at"))

    if is_author:
        if sub["status"] in ("draft", "revisions_requested"):
            pass
        elif sub["status"] == "submitted" and not is_verified:
            pass
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Blind copy cannot be uploaded in status '{sub['status']}'",
            )
    elif is_editor:
        if sub["status"] == "submitted" and not is_verified:
            pass
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Editors may only upload blind copy when status is submitted and unverified",
            )

    pdf_bytes = await read_upload_stream(file, max_mb=settings.MAX_UPLOAD_MB)
    await asyncio.to_thread(validate_pdf, pdf_bytes, settings.MAX_UPLOAD_MB)

    stripped_bytes = await asyncio.to_thread(strip_metadata, pdf_bytes)

    # Best-effort scan for author traces
    declared_authors = await admin_client.get_authors(sub_id_str)
    names = [a["full_name"] for a in declared_authors if a.get("full_name")]
    emails = [a["email"] for a in declared_authors if a.get("email")]

    author_profile = await admin_client.get_profile(sub["author_id"])
    if author_profile and author_profile.get("full_name"):
        names.append(author_profile["full_name"])

    warnings = await asyncio.to_thread(find_author_traces, stripped_bytes, names, emails)

    anon_path = f"{sub_id_str}/v{target_round}.pdf"
    await admin_client.upload_object(
        "manuscripts-anonymized",
        anon_path,
        stripped_bytes,
        "application/pdf",
    )

    # Update version row and clear review note
    existing_v = await admin_client.get_version_row(sub_id_str, target_round)
    if existing_v:
        await admin_client.update_version_fields(
            sub_id_str,
            target_round,
            {"anonymized_path": anon_path, "anonymized_review_note": None},
        )
    else:
        version_data = {
            "submission_id": sub_id_str,
            "round": target_round,
            "manuscript_path": f"{sub['author_id']}/{sub_id_str}/v{target_round}.pdf",
            "anonymized_path": anon_path,
            "file_size_bytes": len(stripped_bytes),
            "uploaded_by": user.user_id,
        }
        await admin_client.upsert_version_row(version_data)

    logger.info(
        "Uploaded blind copy for %s round %d (%d bytes, %d warnings)",
        sub_id_str,
        target_round,
        len(stripped_bytes),
        len(warnings),
    )
    return FileUploadResponse(round=target_round, size=len(stripped_bytes), warnings=warnings)


@router.post("/{submission_id}/submit")
async def submit_manuscript(
    submission_id: uuid.UUID,
    body: SubmitRequest | None = None,
    user: AuthenticatedUser = Depends(get_current_user),
    user_client: SupabaseUserClient = Depends(get_user_client),
    admin_client: SupabaseAdminClient = Depends(get_supabase_admin),
) -> dict[str, Any]:
    """
    Submit draft or revised manuscript for editorial review.
    Validates completeness, stores response_to_reviewers for revisions, and triggers DB guard.
    """
    sub_id_str = str(submission_id)
    sub = await admin_client.get_submission(sub_id_str)
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if sub["author_id"] != user.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if sub["status"] not in ("draft", "revisions_requested"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot submit manuscript in status '{sub['status']}'",
        )

    target_round = sub["current_round"] if sub["status"] == "draft" else sub["current_round"] + 1

    missing_items: list[str] = []

    # 1. Check version row
    v = await admin_client.get_version_row(sub_id_str, target_round)
    if not v or not v.get("manuscript_path"):
        missing_items.append("Manuscript PDF file is required")
    if not v or not v.get("anonymized_path"):
        missing_items.append("Blind copy PDF file is required")

    # 2. Check title in manuscript language
    lang = sub.get("manuscript_language", "en")
    title_obj = sub.get("title") or {}
    if not title_obj.get(lang) or not str(title_obj.get(lang)).strip():
        missing_items.append(f"Title in manuscript language ({lang}) is required")

    # 3. Check declared authors
    declared = await admin_client.get_authors(sub_id_str)
    if len(declared) < 1:
        missing_items.append("At least one author must be declared")

    # 4. Check extraction status
    if sub.get("extraction_status") == "pending":
        missing_items.append("Metadata extraction pipeline is currently pending")

    # 5. Check response to reviewers for revisions
    if sub["status"] == "revisions_requested":
        resp_text = (body.response_to_reviewers if body else "") or ""
        if not resp_text.strip():
            missing_items.append("Response to reviewers is required for resubmission")

    if missing_items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Submission requirements not met: {'; '.join(missing_items)}",
        )

    # For revisions, store response_to_reviewers on version row
    if sub["status"] == "revisions_requested" and body and body.response_to_reviewers:
        await admin_client.update_version_fields(
            sub_id_str,
            target_round,
            {"response_to_reviewers": body.response_to_reviewers.strip()},
        )

    # Transition status via user client so database triggers apply
    await user_client.update(
        "submissions",
        {"status": "submitted"},
        params={"id": f"eq.{sub_id_str}"},
    )

    logger.info("Submission %s successfully submitted for round %d", sub_id_str, target_round)
    return {"id": sub_id_str, "status": "submitted", "round": target_round}


@router.get("/{submission_id}/files/{kind}", response_model=FileDownloadResponse)
async def get_submission_file_download_url(
    submission_id: uuid.UUID,
    kind: Literal["manuscript", "blind-copy"],
    round_num: int | None = Query(default=None, alias="round"),
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
    admin_client: SupabaseAdminClient = Depends(get_supabase_admin),
) -> FileDownloadResponse:
    """
    Get short-lived signed URL for manuscript or blind copy.
    Owner and editor/admin may access manuscript.
    Author and editor/admin may access blind-copy. Reviewers have no access here.
    """
    sub_id_str = str(submission_id)
    sub = await admin_client.get_submission(sub_id_str)
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    is_owner = sub["author_id"] == user.user_id
    is_editor = user.user_role in (Role.EDITOR, Role.ADMIN)

    if not (is_owner or is_editor):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    target_round = round_num or sub["current_round"]
    v = await admin_client.get_version_row(sub_id_str, target_round)
    if not v:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Version for round {target_round} not found",
        )

    if kind == "manuscript":
        path = v.get("manuscript_path")
        bucket = "manuscripts"
    else:
        path = v.get("anonymized_path")
        bucket = "manuscripts-anonymized"

    if not path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File {kind} not found for round {target_round}",
        )

    signed_url = await admin_client.create_signed_url(
        bucket,
        path,
        expires_in=settings.SIGNED_URL_SECONDS,
    )
    return FileDownloadResponse(url=signed_url, expires_in=settings.SIGNED_URL_SECONDS)


# ---------------------------------------------------------------------------
# Editor / Admin Workflow Endpoints
# ---------------------------------------------------------------------------


@router.post("/{submission_id}/blind-copy/verify")
async def verify_blind_copy(
    submission_id: uuid.UUID,
    user: AuthenticatedUser = Depends(require_roles(Role.EDITOR, Role.ADMIN)),
    admin_client: SupabaseAdminClient = Depends(get_supabase_admin),
) -> dict[str, Any]:
    """Verify blind copy for current round. Checks conflict of interest."""
    sub_id_str = str(submission_id)
    sub = await admin_client.get_submission(sub_id_str)
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if sub["author_id"] == user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="conflict of interest: cannot verify own submission",
        )

    round_num = sub["current_round"]
    v = await admin_client.get_version_row(sub_id_str, round_num)
    if not v or not v.get("anonymized_path"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Blind copy has not been uploaded for current round",
        )

    if v.get("anonymized_verified_at"):
        return {"id": sub_id_str, "status": "verified", "round": round_num}

    now_iso = datetime.now(timezone.utc).isoformat()
    await admin_client.update_version_fields(
        sub_id_str,
        round_num,
        {
            "anonymized_verified_at": now_iso,
            "anonymized_verified_by": user.user_id,
            "anonymized_review_note": None,
        },
    )
    logger.info("Blind copy verified for %s round %d by %s", sub_id_str, round_num, user.user_id)
    return {"id": sub_id_str, "status": "verified", "round": round_num}


@router.post("/{submission_id}/blind-copy/reject")
async def reject_blind_copy(
    submission_id: uuid.UUID,
    body: RejectBlindCopyRequest,
    user: AuthenticatedUser = Depends(require_roles(Role.EDITOR, Role.ADMIN)),
    admin_client: SupabaseAdminClient = Depends(get_supabase_admin),
) -> dict[str, Any]:
    """Reject blind copy and supply review feedback note."""
    sub_id_str = str(submission_id)
    sub = await admin_client.get_submission(sub_id_str)
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if sub["author_id"] == user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="conflict of interest: cannot reject own submission",
        )

    round_num = sub["current_round"]
    v = await admin_client.get_version_row(sub_id_str, round_num)
    if not v or not v.get("anonymized_path"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Blind copy has not been uploaded for current round",
        )

    await admin_client.update_version_fields(
        sub_id_str,
        round_num,
        {
            "anonymized_review_note": body.note,
            "anonymized_verified_at": None,
            "anonymized_verified_by": None,
        },
    )
    logger.info("Blind copy rejected for %s round %d by %s", sub_id_str, round_num, user.user_id)
    return {"id": sub_id_str, "status": "rejected", "round": round_num, "note": body.note}


@router.post("/{submission_id}/start-review")
async def start_review(
    submission_id: uuid.UUID,
    user: AuthenticatedUser = Depends(require_roles(Role.EDITOR, Role.ADMIN)),
    user_client: SupabaseUserClient = Depends(get_user_client),
    admin_client: SupabaseAdminClient = Depends(get_supabase_admin),
) -> dict[str, Any]:
    """
    Transition submission from submitted to in_review.
    Requires status submitted and a verified blind copy for current round.
    """
    sub_id_str = str(submission_id)
    sub = await admin_client.get_submission(sub_id_str)
    if not sub:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found")

    if sub["author_id"] == user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="conflict of interest: cannot start review on own submission",
        )

    if sub["status"] != "submitted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot start review: status is '{sub['status']}', expected 'submitted'",
        )

    round_num = sub["current_round"]
    v = await admin_client.get_version_row(sub_id_str, round_num)
    if not v or not v.get("anonymized_verified_at"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot start review: blind copy has not been verified by an editor",
        )

    # Status transition executed via user client to enforce DB triggers
    await user_client.update(
        "submissions",
        {"status": "in_review"},
        params={"id": f"eq.{sub_id_str}"},
    )
    logger.info("Submission %s transitioned to in_review by editor %s", sub_id_str, user.user_id)
    return {"id": sub_id_str, "status": "in_review"}
