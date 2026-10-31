"""
Supabase administrative client using the secret key in the apikey header only.
Never sends the secret key as a Bearer token.

Bypasses RLS — every authorization decision must be made explicitly in API code.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import Depends, HTTPException, Request, status

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class SupabaseAdminClient:
    """Async client for Supabase PostgREST, Auth, and Storage administrative operations."""

    def __init__(self, client: httpx.AsyncClient, settings: Settings):
        self.client = client
        self.settings = settings
        self.base_url = settings.SUPABASE_URL.rstrip("/")
        # Secret key sent exclusively via apikey header
        self.secret_key = settings.SUPABASE_SECRET_KEY.get_secret_value()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _rest_headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        h = {
            "apikey": self.secret_key,
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        if extra:
            h.update(extra)
        return h

    # ------------------------------------------------------------------
    # Auth / profile helpers
    # ------------------------------------------------------------------

    async def get_profile(self, user_id: str) -> dict[str, Any] | None:
        """
        Fetch public.user_profiles row for user_id.
        Selects id, full_name, role, preferred_locale.
        Returns None if not found or on network/request failure.
        """
        url = f"{self.base_url}/rest/v1/user_profiles"
        params = {
            "id": f"eq.{user_id}",
            "select": "id,full_name,role,preferred_locale",
        }
        headers = {
            "apikey": self.secret_key,
            "Accept": "application/json",
        }

        try:
            resp = await self.client.get(url, params=params, headers=headers, timeout=10.0)
            if resp.status_code == 200:
                rows = resp.json()
                if isinstance(rows, list) and len(rows) > 0:
                    return rows[0]
            logger.warning(
                "Profile query for %s returned HTTP %d",
                user_id,
                resp.status_code,
            )
            return None
        except Exception as exc:
            logger.warning("Error fetching user profile for %s: %s", user_id, type(exc).__name__)
            return None

    async def auth_health(self) -> bool:
        """Check availability of the Supabase Auth service."""
        url = f"{self.base_url}/auth/v1/health"
        headers = {
            "apikey": self.secret_key,
        }

        try:
            resp = await self.client.get(url, headers=headers, timeout=5.0)
            return resp.status_code == 200
        except Exception as exc:
            logger.warning("Supabase Auth health check error: %s", type(exc).__name__)
            return False

    # ------------------------------------------------------------------
    # Storage (Stage 1A + Phase 5)
    # ------------------------------------------------------------------

    async def upload_object(
        self,
        bucket: str,
        path: str,
        data: bytes,
        content_type: str = "application/pdf",
        upsert: bool = True,
    ) -> dict[str, Any]:
        """Upload a binary file object to Supabase Storage."""
        url = f"{self.base_url}/storage/v1/object/{bucket}/{path}"
        headers = {
            "apikey": self.secret_key,
            "Content-Type": content_type,
            "x-upsert": "true" if upsert else "false",
        }

        try:
            resp = await self.client.post(url, content=data, headers=headers, timeout=30.0)
            if resp.status_code in (200, 201):
                return resp.json() if resp.content else {"path": path}
            logger.warning("Storage upload failed HTTP %d: %s", resp.status_code, resp.text)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="bad gateway: storage service upload failure",
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Storage upload error for %s/%s: %s", bucket, path, type(exc).__name__)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="bad gateway: storage service communication error",
            ) from exc

    async def download_object(self, bucket: str, path: str) -> bytes:
        """
        Download a Storage object via the authenticated REST endpoint.

        Uses GET /storage/v1/object/authenticated/{bucket}/{path} with the
        secret key in the apikey header (bypasses RLS).

        Raises:
            RuntimeError: on HTTP error or network failure.
        """
        url = f"{self.base_url}/storage/v1/object/authenticated/{bucket}/{path}"
        headers = {
            "apikey": self.secret_key,
        }
        try:
            resp = await self.client.get(url, headers=headers, timeout=120.0)
            if resp.status_code == 200:
                return resp.content
            raise RuntimeError(
                f"Storage download failed: HTTP {resp.status_code} for {bucket}/{path}"
            )
        except RuntimeError:
            raise
        except Exception as exc:
            raise RuntimeError(
                f"Storage download network error for {bucket}/{path}: {type(exc).__name__}"
            ) from exc

    async def create_signed_url(
        self,
        bucket: str,
        path: str,
        expires_in: int = 300,
    ) -> str:
        """Create a temporary signed download URL for a storage object."""
        url = f"{self.base_url}/storage/v1/object/sign/{bucket}/{path}"
        headers = {
            "apikey": self.secret_key,
            "Content-Type": "application/json",
        }
        body = {"expiresIn": expires_in}

        try:
            resp = await self.client.post(url, json=body, headers=headers, timeout=10.0)
            if resp.status_code == 200:
                data = resp.json()
                signed_path = data.get("signedURL") or data.get("signedUrl") or ""
                if signed_path.startswith("http://") or signed_path.startswith("https://"):
                    return signed_path
                return f"{self.base_url}{signed_path}"
            logger.warning("Storage sign URL failed HTTP %d: %s", resp.status_code, resp.text)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="bad gateway: failed to create signed URL",
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Storage sign error for %s/%s: %s", bucket, path, type(exc).__name__)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="bad gateway: storage sign communication error",
            ) from exc

    async def delete_object(self, bucket: str, path: str) -> bool:
        """Delete an object from Supabase Storage."""
        url = f"{self.base_url}/storage/v1/object/{bucket}/{path}"
        headers = {
            "apikey": self.secret_key,
        }
        try:
            resp = await self.client.delete(url, headers=headers, timeout=10.0)
            return resp.status_code in (200, 204)
        except Exception as exc:
            logger.warning("Storage delete error for %s/%s: %s", bucket, path, type(exc).__name__)
            return False

    # ------------------------------------------------------------------
    # Submission helpers (Stage 1A + Phase 5)
    # ------------------------------------------------------------------

    async def get_submission(self, submission_id: str) -> dict[str, Any] | None:
        """
        Fetch a single submissions row by primary key.
        Returns None if not found or on error.
        """
        url = f"{self.base_url}/rest/v1/submissions"
        params = {"id": f"eq.{submission_id}", "limit": "1"}
        try:
            resp = await self.client.get(
                url, params=params, headers=self._rest_headers(), timeout=10.0
            )
            if resp.status_code == 200:
                rows = resp.json()
                if isinstance(rows, list) and rows:
                    return rows[0]
            return None
        except Exception as exc:
            logger.warning("Error fetching submission %s: %s", submission_id, type(exc).__name__)
            return None

    async def update_submission(self, submission_id: str, data: dict[str, Any]) -> bool:
        """
        PATCH a submissions row by primary key.
        Returns True on success, False on error.
        """
        url = f"{self.base_url}/rest/v1/submissions"
        params = {"id": f"eq.{submission_id}"}
        try:
            resp = await self.client.patch(
                url,
                params=params,
                headers=self._rest_headers({"Prefer": "return=minimal"}),
                json=data,
                timeout=10.0,
            )
            return resp.status_code in (200, 204)
        except Exception as exc:
            logger.warning(
                "update_submission error for %s: %s", submission_id, type(exc).__name__
            )
            return False

    async def claim_extraction(
        self, submission_id: str, stale_before_iso: str
    ) -> dict[str, Any] | None:
        """
        Atomically claim a submission for extraction.

        Strategy (two-pass conditional PATCH via PostgREST):
        1. First, try to claim a draft submission that is not already pending:
           PATCH submissions?id=eq.X&status=eq.draft&extraction_status=neq.pending
           sets extraction_status=pending, extraction_error=null.
        2. If no row returned, try to re-claim a stale pending run:
           PATCH submissions?id=eq.X&status=eq.draft&extraction_status=eq.pending
               &updated_at=lt.<stale_before_iso>
           sets the same fields.

        Returns the updated row dict, or None if neither condition matched.

        NOTE: These are two separate PATCH requests, not wrapped in a
        PostgREST transaction, so there is a tiny TOCTOU window. In practice
        two simultaneous re-claims of the same stale run are harmless (both
        would proceed and the second write wins). A proper queue would
        eliminate this entirely.
        """
        url = f"{self.base_url}/rest/v1/submissions"
        patch_headers = self._rest_headers({"Prefer": "return=representation"})
        payload = {"extraction_status": "pending", "extraction_error": None}

        # Pass 1: claim a non-pending draft
        params1 = {
            "id": f"eq.{submission_id}",
            "status": "eq.draft",
            "extraction_status": "neq.pending",
        }
        try:
            resp = await self.client.patch(
                url,
                params=params1,
                headers=patch_headers,
                json=payload,
                timeout=10.0,
            )
            if resp.status_code in (200, 204):
                rows = resp.json() if resp.content else []
                if isinstance(rows, list) and rows:
                    return rows[0]
        except Exception as exc:
            logger.warning(
                "claim_extraction pass-1 error for %s: %s",
                submission_id,
                type(exc).__name__,
            )

        # Pass 2: re-claim a stale pending run
        params2 = {
            "id": f"eq.{submission_id}",
            "status": "eq.draft",
            "extraction_status": "eq.pending",
            "updated_at": f"lt.{stale_before_iso}",
        }
        try:
            resp = await self.client.patch(
                url,
                params=params2,
                headers=patch_headers,
                json=payload,
                timeout=10.0,
            )
            if resp.status_code in (200, 204):
                rows = resp.json() if resp.content else []
                if isinstance(rows, list) and rows:
                    return rows[0]
        except Exception as exc:
            logger.warning(
                "claim_extraction pass-2 error for %s: %s",
                submission_id,
                type(exc).__name__,
            )

        return None

    # ------------------------------------------------------------------
    # Submission version helpers (Stage 1A)
    # ------------------------------------------------------------------

    async def get_version(self, submission_id: str, round_num: int) -> dict[str, Any] | None:
        """
        Fetch a submission_versions row for the given submission and round.
        Returns None if not found or on error.
        """
        url = f"{self.base_url}/rest/v1/submission_versions"
        params = {
            "submission_id": f"eq.{submission_id}",
            "round": f"eq.{round_num}",
            "limit": "1",
        }
        try:
            resp = await self.client.get(
                url, params=params, headers=self._rest_headers(), timeout=10.0
            )
            if resp.status_code == 200:
                rows = resp.json()
                if isinstance(rows, list) and rows:
                    return rows[0]
            return None
        except Exception as exc:
            logger.warning(
                "Error fetching version %s/%d: %s",
                submission_id,
                round_num,
                type(exc).__name__,
            )
            return None

    async def get_version_row(self, submission_id: str, round_num: int) -> dict[str, Any] | None:
        """Alias for get_version — used by Stage 1A call sites."""
        return await self.get_version(submission_id, round_num)

    async def upsert_version_row(self, data: dict[str, Any]) -> dict[str, Any]:
        """Upsert a submission_versions row using admin client."""
        url = f"{self.base_url}/rest/v1/submission_versions"
        params = {"on_conflict": "submission_id,round"}
        headers = {
            "apikey": self.secret_key,
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=representation",
            "Accept": "application/json",
        }

        try:
            resp = await self.client.post(
                url, json=data, params=params, headers=headers, timeout=10.0
            )
            if resp.status_code in (200, 201):
                rows = resp.json()
                if isinstance(rows, list) and len(rows) > 0:
                    return rows[0]
                return rows if isinstance(rows, dict) else {}
            logger.warning("Upsert version failed HTTP %d: %s", resp.status_code, resp.text)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="bad gateway: failed to upsert version row",
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("Error upserting version row: %s", type(exc).__name__)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="bad gateway: database version operation failure",
            ) from exc

    async def update_version_fields(
        self,
        submission_id: str,
        round_num: int,
        fields: dict[str, Any],
    ) -> dict[str, Any]:
        """Update fields on a submission_versions row using admin client."""
        url = f"{self.base_url}/rest/v1/submission_versions"
        params = {
            "submission_id": f"eq.{submission_id}",
            "round": f"eq.{round_num}",
        }
        headers = {
            "apikey": self.secret_key,
            "Content-Type": "application/json",
            "Prefer": "return=representation",
            "Accept": "application/json",
        }
        try:
            resp = await self.client.patch(
                url, json=fields, params=params, headers=headers, timeout=10.0
            )
            if resp.status_code == 200:
                rows = resp.json()
                if isinstance(rows, list) and len(rows) > 0:
                    return rows[0]
                return rows if isinstance(rows, dict) else {}
            logger.warning("Update version fields failed HTTP %d: %s", resp.status_code, resp.text)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="bad gateway: failed to update version row",
            )
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning(
                "Error updating version fields for %s round %d: %s",
                submission_id,
                round_num,
                type(exc).__name__,
            )
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="bad gateway: database version update failure",
            ) from exc

    # ------------------------------------------------------------------
    # Author helpers (Stage 1A + Phase 5)
    # ------------------------------------------------------------------

    async def list_authors(self, submission_id: str) -> list[dict[str, Any]]:
        """
        Return submission_authors rows for a submission ordered by position.
        Returns an empty list on error.
        """
        url = f"{self.base_url}/rest/v1/submission_authors"
        params = {
            "submission_id": f"eq.{submission_id}",
            "order": "position.asc",
        }
        try:
            resp = await self.client.get(
                url, params=params, headers=self._rest_headers(), timeout=10.0
            )
            if resp.status_code == 200:
                rows = resp.json()
                return rows if isinstance(rows, list) else []
            return []
        except Exception as exc:
            logger.warning(
                "list_authors error for %s: %s", submission_id, type(exc).__name__
            )
            return []

    async def get_authors(self, submission_id: str) -> list[dict[str, Any]]:
        """Alias for list_authors — used by Stage 1A call sites."""
        return await self.list_authors(submission_id)

    async def replace_authors(
        self, submission_id: str, authors: list[dict[str, Any]]
    ) -> bool:
        """
        Replace all submission_authors rows for a submission.

        Deletes existing rows, then inserts new ones with position starting at 1.

        WARNING: This is NOT atomic — there is a brief window between DELETE and
        INSERT where no authors exist. In normal operation (background task, single
        writer per submission) this is acceptable. A true atomic replace would
        require a database function or RPC.

        Returns True if both operations succeeded.
        """
        # Step 1: delete existing rows
        del_url = f"{self.base_url}/rest/v1/submission_authors"
        del_params = {"submission_id": f"eq.{submission_id}"}
        try:
            del_resp = await self.client.delete(
                del_url,
                params=del_params,
                headers=self._rest_headers({"Prefer": "return=minimal"}),
                timeout=10.0,
            )
            if del_resp.status_code not in (200, 204):
                logger.warning(
                    "replace_authors delete failed for %s: HTTP %d",
                    submission_id,
                    del_resp.status_code,
                )
                return False
        except Exception as exc:
            logger.warning(
                "replace_authors delete error for %s: %s", submission_id, type(exc).__name__
            )
            return False

        if not authors:
            return True

        # Step 2: insert new rows with position 1..N
        rows = [
            {"submission_id": submission_id, "position": i + 1, **author}
            for i, author in enumerate(authors)
        ]
        ins_url = f"{self.base_url}/rest/v1/submission_authors"
        try:
            ins_resp = await self.client.post(
                ins_url,
                headers=self._rest_headers({"Prefer": "return=minimal"}),
                json=rows,
                timeout=10.0,
            )
            if ins_resp.status_code not in (200, 201, 204):
                logger.warning(
                    "replace_authors insert failed for %s: HTTP %d",
                    submission_id,
                    ins_resp.status_code,
                )
                return False
        except Exception as exc:
            logger.warning(
                "replace_authors insert error for %s: %s", submission_id, type(exc).__name__
            )
            return False

        return True


def get_supabase_admin(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> SupabaseAdminClient:
    """Dependency injecting SupabaseAdminClient backed by shared httpx client."""
    client = getattr(request.app.state, "http_client", None)
    if client is None:
        raise RuntimeError("Application HTTP client not initialized")
    return SupabaseAdminClient(client=client, settings=settings)
