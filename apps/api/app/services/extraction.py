"""
Extraction service: orchestrates PDF download, LLM call, and database updates.

Called as a FastAPI BackgroundTask after the route has already claimed the
submission (set extraction_status = pending).  All exceptions are caught and
recorded as extraction_status = failed.
"""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING, Any

from app.llm.base import LLMError
from app.llm.limiter import ExtractionLimiter
from app.llm.schemas import ExtractionResult

if TYPE_CHECKING:
    from app.clients.supabase_admin import SupabaseAdminClient
    from app.llm.base import LLMProvider

logger = logging.getLogger(__name__)

# Shared limiter for the process (max 2 concurrent, default 10 RPM).
# Can be replaced in tests via dependency injection patterns.
_default_limiter = ExtractionLimiter(max_concurrent=2, max_rpm=10)


class ExtractionService:
    """
    Runs the full extraction pipeline for a single submission.

    Designed to be called as a BackgroundTask after claim_extraction succeeds.
    Never raises — records failures in the database.
    """

    def __init__(
        self,
        admin: SupabaseAdminClient,
        provider: LLMProvider,
        limiter: ExtractionLimiter | None = None,
    ) -> None:
        self._admin = admin
        self._provider = provider
        self._limiter = limiter or _default_limiter

    async def run(self, submission_id: str) -> None:
        """
        Execute the full extraction pipeline.

        Steps:
        1. Load submission + version from the database.
        2. Download PDF from Storage.
        3. Call the LLM provider (through the rate limiter).
        4. Verify the submission is still a draft before writing.
        5. Write title, abstract, keywords, language, succeeded status.
        6. Replace submission_authors.
        On any error: write failed status with safe error message.
        """
        t_start = time.monotonic()
        provider_name = getattr(self._provider, "provider_name", "unknown")
        model_name = getattr(self._provider, "model", "unknown")

        logger.info(
            "extraction.start submission_id=%s provider=%s model=%s",
            submission_id,
            provider_name,
            model_name,
        )

        try:
            # Load submission
            submission = await self._admin.get_submission(submission_id)
            if submission is None:
                raise RuntimeError("Submission not found")

            current_round = submission.get("current_round", 1) or 1

            # Load version
            version = await self._admin.get_version(submission_id, current_round)
            if version is None:
                raise RuntimeError(
                    f"No version found for submission {submission_id} round {current_round}"
                )

            manuscript_path = version.get("manuscript_path")
            if not manuscript_path:
                raise RuntimeError("Version has no manuscript_path")

            # Download PDF
            pdf_bytes = await self._admin.download_object("manuscripts", manuscript_path)

            logger.info(
                "extraction.pdf_downloaded submission_id=%s size_bytes=%d",
                submission_id,
                len(pdf_bytes),
            )

            # Call LLM through the rate limiter
            async with self._limiter:
                result: ExtractionResult = await self._provider.extract_metadata(pdf_bytes)

            elapsed = time.monotonic() - t_start
            logger.info(
                "extraction.llm_done submission_id=%s provider=%s model=%s "
                "duration_s=%.2f outcome=succeeded",
                submission_id,
                provider_name,
                model_name,
                elapsed,
            )

            # Re-check status before writing (safety guard)
            fresh = await self._admin.get_submission(submission_id)
            if fresh is None or fresh.get("status") != "draft":
                logger.warning(
                    "extraction.skip_write submission_id=%s reason=no_longer_draft",
                    submission_id,
                )
                return

            # Build JSONB payloads: only include locales with actual content
            title_jsonb = {k: v for k, v in result.title.items() if v}
            abstract_jsonb = {k: v for k, v in result.abstract.items() if v}
            keywords_jsonb = {k: v for k, v in result.keywords.items() if v}

            update_payload: dict[str, Any] = {
                "title": title_jsonb,
                "abstract": abstract_jsonb,
                "keywords": keywords_jsonb,
                "manuscript_language": result.language,
                "extraction_status": "succeeded",
                "extraction_error": None,
            }
            await self._admin.update_submission(submission_id, update_payload)

            # Build author rows for the database
            author_rows = []
            for author in result.authors:
                affiliation_str = "; ".join(author.affiliations) if author.affiliations else None
                row: dict[str, Any] = {
                    "full_name": author.full_name,
                    "affiliation": affiliation_str,
                    "email": author.email,
                    "orcid": author.orcid,
                    "is_corresponding": author.is_corresponding,
                }
                author_rows.append(row)

            await self._admin.replace_authors(submission_id, author_rows)

            total_elapsed = time.monotonic() - t_start
            logger.info(
                "extraction.complete submission_id=%s provider=%s model=%s "
                "duration_s=%.2f outcome=succeeded authors=%d",
                submission_id,
                provider_name,
                model_name,
                total_elapsed,
                len(author_rows),
            )

        except Exception as exc:
            # Determine a safe public message
            if isinstance(exc, LLMError):
                public_msg = exc.public_message
            else:
                public_msg = "An unexpected error occurred during extraction."

            # Truncate to 300 chars; never include doc text or secrets
            safe_msg = public_msg[:300]

            logger.error(
                "extraction.failed submission_id=%s provider=%s model=%s "
                "error_class=%s duration_s=%.2f",
                submission_id,
                provider_name,
                model_name,
                type(exc).__name__,
                time.monotonic() - t_start,
            )

            try:
                await self._admin.update_submission(
                    submission_id,
                    {
                        "extraction_status": "failed",
                        "extraction_error": safe_msg,
                    },
                )
            except Exception as write_exc:
                logger.error(
                    "extraction.failed_write_error submission_id=%s error_class=%s",
                    submission_id,
                    type(write_exc).__name__,
                )
