"""
Master API router aggregation module.
Registers core routes and conditionally includes debug routes in development.
"""

from __future__ import annotations

from fastapi import APIRouter

from app.api.routes import debug, health, me
from app.core.config import Settings, get_settings


def create_api_router(settings: Settings | None = None) -> APIRouter:
    """Create and configure the master API router."""
    if settings is None:
        settings = get_settings()

    router = APIRouter()

    # Core health & user endpoints
    router.include_router(health.router)
    router.include_router(me.router)

    # Debug role endpoints registered strictly in development
    if settings.APP_ENV == "development":
        router.include_router(debug.router)

    return router


# Module-level default router instance
api_router = create_api_router()
