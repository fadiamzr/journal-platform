"""
User-scoped PostgREST client acting on behalf of the authenticated user.
Passes publishable key in `apikey` header and user token in `Authorization: Bearer <token>`.
Never logs or leaks access tokens or keys.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import Depends, HTTPException, Request, status

from app.clients.errors import map_postgrest_error
from app.core.config import Settings, get_settings
from app.core.deps import get_current_user
from app.core.security import AuthenticatedUser

logger = logging.getLogger(__name__)


class SupabaseUserClient:
    """Async PostgREST client authenticated as the caller."""

    def __init__(
        self,
        base_url: str,
        publishable_key: str,
        access_token: str,
        http_client: httpx.AsyncClient,
    ):
        self.base_url = base_url.rstrip("/")
        self.publishable_key = publishable_key
        self.access_token = access_token
        self.http_client = http_client

    def _get_headers(
        self,
        extra: dict[str, str] | None = None,
        prefer: str | None = None,
    ) -> dict[str, str]:
        headers = {
            "apikey": self.publishable_key,
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        if extra:
            headers.update(extra)
        return headers

    async def select(
        self,
        table: str,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> list[dict[str, Any]]:
        url = f"{self.base_url}/rest/v1/{table}"
        req_headers = self._get_headers(extra=headers)
        try:
            resp = await self.http_client.get(
                url, params=params, headers=req_headers, timeout=15.0
            )
            if resp.status_code == 200:
                data = resp.json()
                return data if isinstance(data, list) else [data]
            raise map_postgrest_error(resp, resource_name=table)
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("PostgREST select error on %s: %s", table, type(exc).__name__)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="bad gateway: upstream database query failure",
            ) from exc

    async def insert(
        self,
        table: str,
        data: dict[str, Any] | list[dict[str, Any]],
        return_representation: bool = True,
    ) -> list[dict[str, Any]]:
        url = f"{self.base_url}/rest/v1/{table}"
        prefer = "return=representation" if return_representation else None
        req_headers = self._get_headers(prefer=prefer)
        try:
            resp = await self.http_client.post(
                url, json=data, headers=req_headers, timeout=15.0
            )
            if resp.status_code in (200, 201):
                if return_representation and resp.content:
                    res = resp.json()
                    return res if isinstance(res, list) else [res]
                return []
            raise map_postgrest_error(resp, resource_name=table)
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("PostgREST insert error on %s: %s", table, type(exc).__name__)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="bad gateway: upstream database insert failure",
            ) from exc

    async def update(
        self,
        table: str,
        data: dict[str, Any],
        params: dict[str, Any] | None = None,
        return_representation: bool = True,
    ) -> list[dict[str, Any]]:
        url = f"{self.base_url}/rest/v1/{table}"
        prefer = "return=representation" if return_representation else None
        req_headers = self._get_headers(prefer=prefer)
        try:
            resp = await self.http_client.patch(
                url, json=data, params=params, headers=req_headers, timeout=15.0
            )
            if resp.status_code == 200:
                if return_representation and resp.content:
                    res = resp.json()
                    return res if isinstance(res, list) else [res]
                return []
            if resp.status_code == 204:
                return []
            raise map_postgrest_error(resp, resource_name=table)
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("PostgREST update error on %s: %s", table, type(exc).__name__)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="bad gateway: upstream database update failure",
            ) from exc

    async def delete(
        self,
        table: str,
        params: dict[str, Any] | None = None,
        return_representation: bool = False,
    ) -> list[dict[str, Any]]:
        url = f"{self.base_url}/rest/v1/{table}"
        prefer = "return=representation" if return_representation else None
        req_headers = self._get_headers(prefer=prefer)
        try:
            resp = await self.http_client.delete(
                url, params=params, headers=req_headers, timeout=15.0
            )
            if resp.status_code in (200, 204):
                if return_representation and resp.content:
                    res = resp.json()
                    return res if isinstance(res, list) else [res]
                return []
            raise map_postgrest_error(resp, resource_name=table)
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("PostgREST delete error on %s: %s", table, type(exc).__name__)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="bad gateway: upstream database delete failure",
            ) from exc

    async def rpc(self, fn: str, params: dict[str, Any] | None = None) -> Any:
        url = f"{self.base_url}/rest/v1/rpc/{fn}"
        req_headers = self._get_headers()
        try:
            resp = await self.http_client.post(
                url, json=params or {}, headers=req_headers, timeout=15.0
            )
            if resp.status_code == 200:
                return resp.json() if resp.content else None
            raise map_postgrest_error(resp, resource_name=fn)
        except HTTPException:
            raise
        except Exception as exc:
            logger.warning("PostgREST rpc error on %s: %s", fn, type(exc).__name__)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="bad gateway: upstream database function failure",
            ) from exc


def get_user_client(
    request: Request,
    user: AuthenticatedUser = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> SupabaseUserClient:
    """FastAPI dependency providing user-scoped PostgREST client."""
    if not settings.SUPABASE_PUBLISHABLE_KEY.strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SUPABASE_PUBLISHABLE_KEY is not configured",
        )
    client = getattr(request.app.state, "http_client", None)
    if client is None:
        raise RuntimeError("Application HTTP client not initialized")
    return SupabaseUserClient(
        base_url=settings.SUPABASE_URL,
        publishable_key=settings.SUPABASE_PUBLISHABLE_KEY,
        access_token=user.token,
        http_client=client,
    )
