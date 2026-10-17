"""
Current user profile endpoint.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends

from app.clients.supabase_admin import SupabaseAdminClient, get_supabase_admin
from app.core.deps import get_current_user
from app.core.security import AuthenticatedUser

router = APIRouter(tags=["me"])


@router.get("/me", summary="Current user details")
async def me(
    user: AuthenticatedUser = Depends(get_current_user),
    admin: SupabaseAdminClient = Depends(get_supabase_admin),
) -> dict[str, Any]:
    """
    Returns authenticated user information decoded from the verified JWT,
    combined with database user profile data if available.
    """
    profile = await admin.get_profile(user.user_id)

    return {
        "user_id": user.user_id,
        "email": user.email,
        "user_role": user.user_role.value if user.user_role else None,
        "profile": profile,
    }
