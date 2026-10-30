"""
Supabase administrative client using the secret key in the apikey header only.
Never sends the secret key as a Bearer token.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import Depends, HTTPException, Request, status

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class SupabaseAdminClient:
    """Async client for Supabase PostgREST, Storage, and Auth administrative operations."""

    def __init__(self, client: httpx.AsyncClient, settings: Settings):
        self.client = client
        self.settings = settings
        self.base_url = settings.SUPABASE_URL.rstrip("/")
        # Secret key sent exclusively via apikey header
        self.secret_key = settings.SUPABASE_SECRET_KEY.get_secret_value()

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

    async def get_version_row(self, submission_id: str, round_num: int) -> dict[str, Any] | None:
        """Fetch submission_versions row for a specific round using admin client."""
        url = f"{self.base_url}/rest/v1/submission_versions"
        params = {
            "submission_id": f"eq.{submission_id}",
            "round": f"eq.{round_num}",
            "select": "*",
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
            return None
        except Exception as exc:
            logger.warning(
                "Error querying version row for %s round %d: %s",
                submission_id,
                round_num,
                type(exc).__name__,
            )
            return None

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

    async def get_submission(self, submission_id: str) -> dict[str, Any] | None:
        """Fetch submission by ID using admin client."""
        url = f"{self.base_url}/rest/v1/submissions"
        params = {
            "id": f"eq.{submission_id}",
            "select": "*",
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
            return None
        except Exception as exc:
            logger.warning("Error fetching submission %s: %s", submission_id, type(exc).__name__)
            return None

    async def get_authors(self, submission_id: str) -> list[dict[str, Any]]:
        """Fetch declared authors for submission using admin client."""
        url = f"{self.base_url}/rest/v1/submission_authors"
        params = {
            "submission_id": f"eq.{submission_id}",
            "order": "position.asc",
            "select": "*",
        }
        headers = {
            "apikey": self.secret_key,
            "Accept": "application/json",
        }
        try:
            resp = await self.client.get(url, params=params, headers=headers, timeout=10.0)
            if resp.status_code == 200:
                rows = resp.json()
                return rows if isinstance(rows, list) else []
            return []
        except Exception as exc:
            logger.warning("Error fetching authors for %s: %s", submission_id, type(exc).__name__)
            return []

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


def get_supabase_admin(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> SupabaseAdminClient:
    """Dependency injecting SupabaseAdminClient backed by shared httpx client."""
    client = getattr(request.app.state, "http_client", None)
    if client is None:
        raise RuntimeError("Application HTTP client not initialized")
    return SupabaseAdminClient(client=client, settings=settings)
