"""
Supabase administrative client using the secret key in the apikey header only.
Never sends the secret key as a Bearer token.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import Depends, Request

from app.core.config import Settings, get_settings

logger = logging.getLogger(__name__)


class SupabaseAdminClient:
    """Async client for Supabase PostgREST and Auth administrative operations."""

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


def get_supabase_admin(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> SupabaseAdminClient:
    """Dependency injecting SupabaseAdminClient backed by shared httpx client."""
    client = getattr(request.app.state, "http_client", None)
    if client is None:
        raise RuntimeError("Application HTTP client not initialized")
    return SupabaseAdminClient(client=client, settings=settings)
