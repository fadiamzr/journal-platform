"""
PostgREST and PostgreSQL error code mapping to uniform FastAPI HTTPExceptions.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


def map_postgrest_error(response: httpx.Response, resource_name: str = "resource") -> HTTPException:
    """
    Parse a PostgREST error response and return an appropriate HTTPException.
    Never exposes internal SQL or database details in generic 502 messages.
    """
    try:
        body: Any = response.json()
    except Exception:
        body = {}

    code: str = ""
    message: str = ""
    details: str = ""

    if isinstance(body, dict):
        code = str(body.get("code") or "")
        message = str(body.get("message") or "")
        details = str(body.get("details") or "")

    # 42501 -> 403 Forbidden
    if code == "42501" or response.status_code == 403:
        return HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="forbidden: insufficient permissions",
        )

    # 23514 or trigger "invalid status transition" -> 409 Conflict with friendly message
    if (
        code == "23514"
        or "invalid status transition" in message.lower()
        or "invalid status transition" in details.lower()
    ):
        msg = "invalid status transition or validation constraint violation"
        if "invalid status transition" in message.lower():
            msg = message
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=msg,
        )

    # 23505 -> 409 Conflict
    if code == "23505":
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{resource_name.capitalize()} already exists or conflicts with existing state",
        )

    # 23503 -> 422 Unprocessable Content
    if code == "23503":
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Referenced {resource_name} does not exist",
        )

    # 22P02 or 23502 -> 422 Unprocessable Content
    if code in ("22P02", "23502"):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Invalid input syntax or missing required field",
        )

    # Everything else -> 502 Bad Gateway with generic message (no upstream body)
    logger.warning(
        "Upstream PostgREST error HTTP %d: %s (code=%s)",
        response.status_code,
        message,
        code,
    )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="bad gateway: upstream service error",
    )


def raise_not_found_if_empty(rows: list[Any], resource_name: str = "Resource") -> None:
    """Raise 404 if rows list is empty."""
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource_name} not found",
        )
