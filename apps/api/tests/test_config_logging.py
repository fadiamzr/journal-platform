"""
Tests for settings validation, structured log redaction, and production route exclusion.
"""

from __future__ import annotations

import io
import json
import logging

import httpx
import pytest
from pydantic import SecretStr

from app.core.config import Settings
from app.core.logging import JSONFormatter, RedactingFilter
from app.main import create_app


def test_settings_fail_with_names_only_message_when_required_vars_missing(monkeypatch):
    """Missing required settings fail startup with a message listing only variable names."""
    # Ensure environment does not supply values
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SECRET_KEY", raising=False)
    monkeypatch.delenv("SUPABASE_JWKS_URL", raising=False)

    with pytest.raises(ValueError) as exc_info:
        Settings(
            SUPABASE_URL="",
            SUPABASE_SECRET_KEY=SecretStr(""),
            SUPABASE_JWKS_URL="",
        )

    msg = str(exc_info.value)
    # Lists variable names
    assert "SUPABASE_URL" in msg
    assert "SUPABASE_SECRET_KEY" in msg
    assert "SUPABASE_JWKS_URL" in msg
    # Must never include values or passwords
    assert "postgres:" not in msg
    assert ("sb_" + "secret") not in msg


def test_secrets_and_tokens_never_appear_in_captured_logs():
    """Structured logging scrubs bearer tokens, API keys, JWTs, and credential URLs."""
    stream = io.StringIO()
    handler = logging.StreamHandler(stream)
    handler.addFilter(RedactingFilter())
    handler.setFormatter(JSONFormatter())

    test_logger = logging.getLogger("test_redaction_logger")
    test_logger.setLevel(logging.INFO)
    test_logger.addHandler(handler)

    sample_jwt = (
        "eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9."
        "eyJzdWIiOiIxMjM0NTY3ODkwIn0."
        "abcdefghijklmnopqrstuvwxyz1234567890"
    )
    sample_secret = "sb_" + "secret_" + "99887766554433221100"
    sample_publishable = "sb_" + "publishable_" + "aabbccddeeffgghh"
    sample_db_url = "postgresql://postgres:secret_db_password_123@db.supabase.co:5432/postgres"

    test_logger.info(
        "Request failed for Bearer %s with key %s, pubkey %s, and DB %s",
        sample_jwt,
        sample_secret,
        sample_publishable,
        sample_db_url,
    )

    output = stream.getvalue().strip()
    assert output, "Log output should not be empty"

    log_obj = json.loads(output)
    msg = log_obj["message"]

    # None of the sensitive strings must remain in the output
    assert sample_jwt not in msg
    assert sample_secret not in msg
    assert sample_publishable not in msg
    assert "secret_db_password_123" not in msg

    # Scrubbed markers must be present
    assert "[REDACTED]" in msg


@pytest.mark.asyncio
async def test_debug_routes_are_absent_when_app_env_is_production(mock_http_client):
    """Debug endpoints under /debug are not registered when APP_ENV is production."""
    prod_settings = Settings(
        APP_ENV="production",
        SUPABASE_URL="https://mock.supabase.co",
        SUPABASE_SECRET_KEY=SecretStr("mock_secret"),
        SUPABASE_JWKS_URL="https://mock.supabase.co/auth/v1/.well-known/jwks.json",
    )
    prod_app = create_app(prod_settings)
    prod_app.state.http_client = mock_http_client

    transport = httpx.ASGITransport(app=prod_app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as prod_client:
        # Core routes exist
        resp_health = await prod_client.get("/health")
        assert resp_health.status_code == 200

        # Debug routes do not exist (404)
        resp_debug_author = await prod_client.get("/debug/author")
        assert resp_debug_author.status_code == 404

        resp_debug_editor = await prod_client.get("/debug/editor")
        assert resp_debug_editor.status_code == 404
