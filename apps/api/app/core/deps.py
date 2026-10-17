"""
FastAPI dependencies for authentication, role verification, and client access.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from enum import StrEnum
from typing import Any

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import Settings, get_settings
from app.core.security import AuthenticatedUser, verify_jwt_token

logger = logging.getLogger(__name__)

# HTTPBearer with auto_error=False to allow consistent 401 error response shape
bearer_scheme = HTTPBearer(auto_error=False)


class Role(StrEnum):
    """Platform roles defined in public.user_role enum."""

    AUTHOR = "author"
    REVIEWER = "reviewer"
    EDITOR = "editor"
    ADMIN = "admin"


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> AuthenticatedUser:
    """Extract and cryptographically verify the JWT bearer token from Authorization header."""
    if not credentials or credentials.scheme.lower() != "bearer" or not credentials.credentials:
        logger.warning("Missing or malformed Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Use the shared AsyncClient attached to application lifespan
    client = getattr(request.app.state, "http_client", None)
    if client is None:
        raise RuntimeError("Application lifespan HTTP client not initialized")

    return await verify_jwt_token(
        token=credentials.credentials,
        client=client,
        settings=settings,
    )


def require_roles(*allowed_roles: Role) -> Callable[..., Any]:
    """
    Dependency factory enforcing role-based access control.
    Role semantics:
      - Admin is permitted wherever Editor is permitted.
      - Null or unknown roles are always denied (403).
      - Otherwise exact role match is required.
    """

    async def role_checker(
        user: AuthenticatedUser = Depends(get_current_user),
    ) -> AuthenticatedUser:
        if user.user_role is None:
            logger.warning("Access denied for user %s: no platform role assigned", user.user_id)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="forbidden: insufficient permissions",
            )

        # Expand allowed roles: admin is allowed wherever editor is allowed
        effective_roles = set(allowed_roles)
        if Role.EDITOR in effective_roles:
            effective_roles.add(Role.ADMIN)

        if user.user_role not in effective_roles:
            logger.warning(
                "Access denied for user %s: role '%s' not in %s",
                user.user_id,
                user.user_role,
                [r.value for r in effective_roles],
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="forbidden: insufficient permissions",
            )

        return user

    return role_checker
