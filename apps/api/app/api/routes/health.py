"""
Health check endpoints for liveness and readiness probes.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse

from app.clients.supabase_admin import SupabaseAdminClient, get_supabase_admin
from app.core.config import Settings, get_settings
from app.core.security import jwks_cache

router = APIRouter(tags=["health"])


@router.get("/health", summary="Liveness probe")
async def health(settings: Settings = Depends(get_settings)) -> dict[str, Any]:
    """Liveness probe indicating the FastAPI service is running."""
    return {
        "status": "ok",
        "app_env": settings.APP_ENV,
        "version": "0.1.0",
    }


@router.get("/health/ready", summary="Readiness probe")
async def health_ready(
    request: Request,
    settings: Settings = Depends(get_settings),
    admin: SupabaseAdminClient = Depends(get_supabase_admin),
) -> JSONResponse:
    """
    Readiness probe validating external service connectivity.
    Checks JWKS key availability and Supabase Auth status.
    Returns 200 if all checks pass, 503 if any check fails. Never leaks secrets.
    """
    client = getattr(request.app.state, "http_client", None)
    if client is None:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "ready": False,
                "checks": {"jwks": False, "auth": False},
            },
        )

    jwks_ok = await jwks_cache.check_health(client, settings.SUPABASE_JWKS_URL)
    auth_ok = await admin.auth_health()

    ready = jwks_ok and auth_ok
    status_code = status.HTTP_200_OK if ready else status.HTTP_503_SERVICE_UNAVAILABLE

    return JSONResponse(
        status_code=status_code,
        content={
            "ready": ready,
            "checks": {
                "jwks": jwks_ok,
                "auth": auth_ok,
            },
        },
    )
