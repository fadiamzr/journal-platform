"""
Tests for /health, /health/ready, and X-Request-ID propagation.
"""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_health_returns_200(client, test_settings):
    """GET /health returns 200 with service metadata."""
    resp = await client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["app_env"] == test_settings.APP_ENV
    assert data["version"] == "0.1.0"


@pytest.mark.asyncio
async def test_health_ready_success_returns_200(client):
    """GET /health/ready returns 200 when JWKS and Supabase Auth checks pass."""
    resp = await client.get("/health/ready")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ready"] is True
    assert data["checks"]["jwks"] is True
    assert data["checks"]["auth"] is True


@pytest.mark.asyncio
async def test_health_ready_jwks_failure_returns_503(client, mock_jwks_state):
    """GET /health/ready returns 503 when JWKS endpoint cannot be fetched."""
    mock_jwks_state["jwks_status_code"] = 500
    resp = await client.get("/health/ready")
    assert resp.status_code == 503
    data = resp.json()
    assert data["ready"] is False
    assert data["checks"]["jwks"] is False


@pytest.mark.asyncio
async def test_health_ready_auth_failure_returns_503(client, mock_jwks_state):
    """GET /health/ready returns 503 when Supabase Auth health check fails."""
    mock_jwks_state["auth_health_ok"] = False
    resp = await client.get("/health/ready")
    assert resp.status_code == 503
    data = resp.json()
    assert data["ready"] is False
    assert data["checks"]["auth"] is False


@pytest.mark.asyncio
async def test_request_id_echoed_in_response_header(client):
    """X-Request-ID is echoed when supplied by client, and generated when missing."""
    # 1. Custom incoming request ID is echoed
    custom_id = "req-custom-trace-12345"
    resp1 = await client.get("/health", headers={"X-Request-ID": custom_id})
    assert resp1.headers.get("X-Request-ID") == custom_id

    # 2. When missing, a valid UUID request ID is generated and returned
    resp2 = await client.get("/health")
    gen_id = resp2.headers.get("X-Request-ID")
    assert gen_id is not None
    assert len(gen_id) >= 16
