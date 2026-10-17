"""
Structured JSON logging with request context and sensitive token redaction filter.
"""

from __future__ import annotations

import json
import logging
import re
import sys
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any

# Context variables for request tracing
request_id_ctx: ContextVar[str] = ContextVar("request_id_ctx", default="-")
request_path_ctx: ContextVar[str] = ContextVar("request_path_ctx", default="-")

# Redaction patterns for tokens, keys, credentials, and full URLs with passwords
_REDACTION_PATTERNS = [
    # Authorization header / Bearer token
    (re.compile(r"(?i)\bbearer\s+[A-Za-z0-9_\-\.]+", re.IGNORECASE), "Bearer [REDACTED]"),
    # JWT structure (three base64url segments)
    (re.compile(r"\bey[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]+"), "[REDACTED]"),
    # Supabase secret and publishable keys
    (re.compile(r"\bsb_(?:secret|publishable)_[A-Za-z0-9_\-]{8,}"), "[REDACTED]"),
    (re.compile(r"\bsb_[A-Za-z0-9_\-]{20,}"), "[REDACTED]"),
    # Database / HTTP URLs containing credentials
    (re.compile(r"([a-zA-Z]+://)([^:\s]+):([^@\s]+)@"), r"\1[REDACTED]@"),
]


def redact_sensitive_string(text: str) -> str:
    """Scrub tokens, API keys, passwords, and credentials from a text string."""
    for pattern, replacement in _REDACTION_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


class RedactingFilter(logging.Filter):
    """Logging filter that scrubs sensitive patterns and attaches request context."""

    def filter(self, record: logging.LogRecord) -> bool:
        # Attach request tracing context
        if not hasattr(record, "request_id"):
            record.request_id = request_id_ctx.get()
        if not hasattr(record, "path"):
            record.path = request_path_ctx.get()

        # Redact record.msg if string
        if isinstance(record.msg, str):
            record.msg = redact_sensitive_string(record.msg)

        # Redact string arguments
        if record.args:
            if isinstance(record.args, dict):
                record.args = {
                    k: redact_sensitive_string(v) if isinstance(v, str) else v
                    for k, v in record.args.items()
                }
            elif isinstance(record.args, (list, tuple)):
                record.args = tuple(
                    redact_sensitive_string(arg) if isinstance(arg, str) else arg
                    for arg in record.args
                )

        return True


class JSONFormatter(logging.Formatter):
    """Formats log records as structured single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        # Format the log message with any arguments already filtered
        try:
            message = record.getMessage()
        except Exception:
            message = str(record.msg)

        # Extra safety pass on the formatted message
        message = redact_sensitive_string(message)

        log_data: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": message,
            "request_id": getattr(record, "request_id", "-"),
            "path": getattr(record, "path", "-"),
        }

        if record.exc_info:
            exc_text = self.formatException(record.exc_info)
            log_data["exception"] = redact_sensitive_string(exc_text)

        return json.dumps(log_data)


def setup_logging(log_level: str = "INFO") -> None:
    """Initialize structured JSON logging on the root logger."""
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level.upper())

    # Avoid duplicate handlers if reconfigured
    root_logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(RedactingFilter())
    handler.setFormatter(JSONFormatter())
    root_logger.addHandler(handler)
