"""
Development-only debug endpoints for role-based access control verification.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.core.deps import Role, require_roles
from app.core.security import AuthenticatedUser

router = APIRouter(prefix="/debug", tags=["debug"])


@router.get("/author", summary="Debug author role")
async def debug_author(
    user: AuthenticatedUser = Depends(require_roles(Role.AUTHOR)),
) -> dict[str, Any]:
    return {"ok": True, "role": "author"}


@router.get("/reviewer", summary="Debug reviewer role")
async def debug_reviewer(
    user: AuthenticatedUser = Depends(require_roles(Role.REVIEWER)),
) -> dict[str, Any]:
    return {"ok": True, "role": "reviewer"}


@router.get("/editor", summary="Debug editor role (also allows admin)")
async def debug_editor(
    user: AuthenticatedUser = Depends(require_roles(Role.EDITOR)),
) -> dict[str, Any]:
    return {"ok": True, "role": "editor"}


@router.get("/admin", summary="Debug admin role")
async def debug_admin(
    user: AuthenticatedUser = Depends(require_roles(Role.ADMIN)),
) -> dict[str, Any]:
    return {"ok": True, "role": "admin"}
