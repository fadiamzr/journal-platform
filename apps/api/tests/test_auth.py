"""
Tests for JWT verification, ES256 algorithm enforcement, JWKS caching, and error handling.
"""

from __future__ import annotations

import jwt
import pytest


@pytest.mark.asyncio
async def test_valid_token_me_returns_claims(client, token_builder):
    """Valid ES256 token returns 200 with claims on /me."""
    token = token_builder(
        sub="11111111-1111-1111-1111-111111111111",
        email="author@example.com",
        user_role="author",
    )
    resp = await client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["user_id"] == "11111111-1111-1111-1111-111111111111"
    assert data["email"] == "author@example.com"
    assert data["user_role"] == "author"
    assert data["profile"] is not None
    assert data["profile"]["role"] == "author"


@pytest.mark.asyncio
async def test_expired_token_returns_401(client, token_builder):
    """Expired token returns 401 with standard error shape and WWW-Authenticate header."""
    token = token_builder(exp_delta=-60)
    resp = await client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401
    assert resp.headers.get("WWW-Authenticate") == "Bearer"
    err = resp.json()["error"]
    assert err["code"] == "unauthorized"
    assert err["message"] == "invalid or expired token"
    assert "request_id" in err


@pytest.mark.asyncio
async def test_wrong_audience_returns_401(client, token_builder):
    """Token with wrong audience claim is rejected with 401."""
    token = token_builder(aud="wrong_audience")
    resp = await client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.asyncio
async def test_wrong_issuer_returns_401(client, token_builder):
    """Token with wrong issuer claim is rejected with 401."""
    token = token_builder(iss="https://untrusted-issuer.supabase.co/auth/v1")
    resp = await client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.asyncio
async def test_token_signed_by_different_key_returns_401(client, token_builder, second_key_pair):
    """Token signed by a key not in JWKS (even if claiming same kid) fails signature check."""
    second_private_key, _ = second_key_pair
    token = token_builder(signing_key=second_private_key, kid="test-key-1")
    resp = await client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.asyncio
async def test_forged_hs256_token_rejected_with_401(client, test_settings):
    """Forged token using symmetric HS256 is strictly rejected (algorithm confusion prevention)."""
    payload = {
        "sub": "11111111-1111-1111-1111-111111111111",
        "aud": test_settings.JWT_AUDIENCE,
        "iss": test_settings.jwt_issuer,
        "exp": 9999999999,
        "iat": 1000000000,
        "user_role": "admin",
    }
    # Attacker tries using public key bytes or secret as HMAC key
    forged_token = jwt.encode(
        payload,
        key="attacker_secret",
        algorithm="HS256",
        headers={"kid": "test-key-1"},
    )
    resp = await client.get("/me", headers={"Authorization": f"Bearer {forged_token}"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.asyncio
async def test_alg_none_token_rejected_with_401(client, test_settings):
    """Token using alg=none is strictly rejected with 401."""
    payload = {
        "sub": "11111111-1111-1111-1111-111111111111",
        "aud": test_settings.JWT_AUDIENCE,
        "iss": test_settings.jwt_issuer,
        "exp": 9999999999,
        "iat": 1000000000,
        "user_role": "admin",
    }
    none_token = jwt.encode(payload, key="", algorithm="none", headers={"kid": "test-key-1"})
    resp = await client.get("/me", headers={"Authorization": f"Bearer {none_token}"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "unauthorized"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "auth_header",
    [
        None,
        "",
        "Basic dXNlcjpwYXNz",
        "Bearer",
        "Bearer    ",
        "Bearer not-a-valid-jwt",
        "Token eyJhbGciOi...",
    ],
)
async def test_missing_or_malformed_auth_header_returns_401(client, auth_header):
    """Missing or malformed Authorization header returns standardized 401 response."""
    headers = {"Authorization": auth_header} if auth_header is not None else {}
    resp = await client.get("/me", headers=headers)
    assert resp.status_code == 401
    assert resp.headers.get("WWW-Authenticate") == "Bearer"
    err = resp.json()["error"]
    assert err["code"] == "unauthorized"
    assert err["message"] == "invalid or expired token"
    assert "request_id" in err


@pytest.mark.asyncio
async def test_jwks_cache_is_used_on_repeated_requests(client, token_builder, mock_jwks_state):
    """
    JWKS is fetched once and cached; subsequent requests reuse cached keys
    without network calls.
    """
    token = token_builder()
    assert mock_jwks_state["fetch_count"] == 0

    # Request 1: cache miss, triggers fetch
    resp1 = await client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert resp1.status_code == 200
    assert mock_jwks_state["fetch_count"] == 1

    # Request 2: cache hit, no additional network fetch
    resp2 = await client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert resp2.status_code == 200
    assert mock_jwks_state["fetch_count"] == 1

    # Request 3: cache hit, no additional network fetch
    resp3 = await client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert resp3.status_code == 200
    assert mock_jwks_state["fetch_count"] == 1


@pytest.mark.asyncio
async def test_unknown_kid_refresh_and_rate_limit(client, token_builder, mock_jwks_state):
    """
    An unknown kid triggers exactly one JWKS refresh.
    A second unknown kid within 60 seconds does not trigger another network fetch.
    """
    assert mock_jwks_state["fetch_count"] == 0

    # 1. First unknown kid: initial fetch + 1 refresh attempt = 2 fetches
    token1 = token_builder(kid="unknown-kid-1")
    resp1 = await client.get("/me", headers={"Authorization": f"Bearer {token1}"})
    assert resp1.status_code == 401
    # 1 initial fetch + 1 refresh attempt for unknown kid
    assert mock_jwks_state["fetch_count"] == 2

    # 2. Second unknown kid within 60s: rate-limited, no additional network fetch
    token2 = token_builder(kid="unknown-kid-2")
    resp2 = await client.get("/me", headers={"Authorization": f"Bearer {token2}"})
    assert resp2.status_code == 401
    assert mock_jwks_state["fetch_count"] == 2
