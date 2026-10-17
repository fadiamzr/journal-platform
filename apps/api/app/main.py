"""
FastAPI application factory, lifecycle, middleware, and centralized error handling.
"""

from __future__ import annotations

import logging
import re
import uuid
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.router import create_api_router
from app.core.config import Settings, get_settings
from app.core.logging import request_id_ctx, request_path_ctx, setup_logging

logger = logging.getLogger(__name__)

# Request ID regex validation (alphanumeric, dashes, underscores, max 128 chars)
_SAFE_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9_\-\.]{1,128}$")


def _get_request_id(request: Request) -> str:
    """Retrieve or generate a request ID from request state."""
    return getattr(request.state, "request_id", None) or str(uuid.uuid4())


def _status_to_error_code(status_code: int) -> str:
    """Map standard HTTP status codes to machine-readable error codes."""
    mapping = {
        status.HTTP_400_BAD_REQUEST: "bad_request",
        status.HTTP_401_UNAUTHORIZED: "unauthorized",
        status.HTTP_403_FORBIDDEN: "forbidden",
        status.HTTP_404_NOT_FOUND: "not_found",
        status.HTTP_405_METHOD_NOT_ALLOWED: "method_not_allowed",
        status.HTTP_408_REQUEST_TIMEOUT: "request_timeout",
        status.HTTP_409_CONFLICT: "conflict",
        status.HTTP_422_UNPROCESSABLE_ENTITY: "validation_error",
        status.HTTP_429_TOO_MANY_REQUESTS: "too_many_requests",
        status.HTTP_500_INTERNAL_SERVER_ERROR: "internal_error",
        status.HTTP_502_BAD_GATEWAY: "bad_gateway",
        status.HTTP_503_SERVICE_UNAVAILABLE: "service_unavailable",
    }
    return mapping.get(status_code, "http_error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager creating and closing the shared AsyncClient."""
    client = httpx.AsyncClient(timeout=20.0)
    app.state.http_client = client
    yield
    await client.aclose()


def create_app(settings: Settings | None = None) -> FastAPI:
    """FastAPI application factory."""
    if settings is None:
        settings = get_settings()

    setup_logging(settings.LOG_LEVEL)

    application = FastAPI(
        title="Journal Platform API",
        version="0.1.0",
        lifespan=lifespan,
    )

    if settings is not None:
        application.dependency_overrides[get_settings] = lambda: settings

    # ---------------------------------------------------------------------------
    # Middleware: Request ID and Tracing Context
    # ---------------------------------------------------------------------------
    @application.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        incoming_id = request.headers.get("X-Request-ID", "").strip()
        if incoming_id and _SAFE_REQUEST_ID_RE.match(incoming_id):
            request_id = incoming_id
        else:
            request_id = str(uuid.uuid4())

        request.state.request_id = request_id
        token_id = request_id_ctx.set(request_id)
        token_path = request_path_ctx.set(request.url.path)

        try:
            response = await call_next(request)
            response.headers["X-Request-ID"] = request_id
            return response
        finally:
            request_id_ctx.reset(token_id)
            request_path_ctx.reset(token_path)

    # ---------------------------------------------------------------------------
    # Middleware: CORS
    # ---------------------------------------------------------------------------
    cors_origins = settings.cors_origins_list
    if cors_origins:
        application.add_middleware(
            CORSMiddleware,
            allow_origins=cors_origins,
            allow_credentials=False,
            allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        )

    # ---------------------------------------------------------------------------
    # Exception Handlers: Centralized, Consistent Error Shape
    # Shape: {"error": {"code": str, "message": str, "request_id": str}}
    # ---------------------------------------------------------------------------
    @application.exception_handler(StarletteHTTPException)
    @application.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException | HTTPException):
        req_id = _get_request_id(request)
        code = _status_to_error_code(exc.status_code)
        message = str(exc.detail) if exc.detail else "An error occurred"

        headers = getattr(exc, "headers", None) or {}
        # Ensure X-Request-ID is attached
        headers["X-Request-ID"] = req_id

        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": {
                    "code": code,
                    "message": message,
                    "request_id": req_id,
                }
            },
            headers=headers,
        )

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError):
        req_id = _get_request_id(request)
        # Summarize validation errors without leaking sensitive fields
        error_msgs = []
        for err in exc.errors():
            loc = " -> ".join(str(part) for part in err.get("loc", []))
            msg = err.get("msg", "Invalid value")
            error_msgs.append(f"{loc}: {msg}" if loc else msg)

        summary_msg = "; ".join(error_msgs) if error_msgs else "Invalid request payload"

        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": {
                    "code": "validation_error",
                    "message": summary_msg,
                    "request_id": req_id,
                }
            },
            headers={"X-Request-ID": req_id},
        )

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        req_id = _get_request_id(request)
        # Log internal error without leaking stack traces to the client
        logger.exception("Unhandled server exception: %s", type(exc).__name__)

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": {
                    "code": "internal_error",
                    "message": "Internal server error",
                    "request_id": req_id,
                }
            },
            headers={"X-Request-ID": req_id},
        )

    # ---------------------------------------------------------------------------
    # Route Registration
    # ---------------------------------------------------------------------------
    application.include_router(create_api_router(settings))

    return application


# Default module-level application instance
app = create_app()
