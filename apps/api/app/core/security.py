"""
JWT verification with PyJWT, ES256 enforcement, in-memory JWKS caching,
and rate-limited unknown-kid refresh.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import httpx
import jwt
from fastapi import HTTPException, status
from jwt import PyJWKSet

if TYPE_CHECKING:
    from app.core.config import Settings
    from app.core.deps import Role

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AuthenticatedUser:
    """Authenticated user context derived from a validated Supabase JWT."""

    user_id: str
    email: str | None
    user_role: Role | None
    raw_claims: dict[str, Any]


class JWKSCache:
    """In-memory cache for Supabase public JWKS with rate-limited refresh on unknown kids."""

    def __init__(self, rate_limit_seconds: float = 60.0):
        self.rate_limit_seconds = rate_limit_seconds
        self.jwk_set: PyJWKSet | None = None
        self.last_fetch_time: float = 0.0
        self.last_kid_refresh_time: float = 0.0
        self._lock = asyncio.Lock()

    async def _fetch_jwks(self, client: httpx.AsyncClient, jwks_url: str) -> PyJWKSet:
        """Fetch JWKS keyset over HTTP using the provided client."""
        resp = await client.get(jwks_url, timeout=10.0)
        if resp.status_code != 200:
            raise RuntimeError(f"JWKS endpoint returned HTTP {resp.status_code}")
        jwks_data = resp.json()
        return PyJWKSet.from_dict(jwks_data)

    async def get_key_for_token(
        self,
        token: str,
        client: httpx.AsyncClient,
        jwks_url: str,
        ttl_seconds: int = 600,
    ) -> Any:
        """Retrieve the public cryptographic key matching the token's kid header."""
        try:
            unverified_header = jwt.get_unverified_header(token)
        except Exception as exc:
            logger.warning("Failed to decode token header: %s", type(exc).__name__)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

        # Strict algorithm restriction: only ES256 is permitted
        alg = unverified_header.get("alg")
        if alg != "ES256":
            logger.warning("Token algorithm '%s' rejected (only ES256 allowed)", alg)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        kid = unverified_header.get("kid")
        if not kid:
            logger.warning("Token header missing 'kid'")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        now = time.monotonic()
        async with self._lock:
            # Refresh if cache is uninitialized or TTL expired
            if self.jwk_set is None or (now - self.last_fetch_time) > ttl_seconds:
                try:
                    self.jwk_set = await self._fetch_jwks(client, jwks_url)
                    self.last_fetch_time = now
                except Exception as exc:
                    logger.warning("Failed to fetch JWKS: %s", type(exc).__name__)
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="invalid or expired token",
                        headers={"WWW-Authenticate": "Bearer"},
                    ) from exc

            # Check if key is in current keyset
            key = self._find_key_by_kid(kid)
            if key is not None:
                return key.key

            # Unknown kid: refresh once, but at most once per 60 seconds
            if (now - self.last_kid_refresh_time) < self.rate_limit_seconds:
                logger.warning(
                    "Unknown kid '%s', refresh skipped due to rate limit (%.1fs remaining)",
                    kid,
                    self.rate_limit_seconds - (now - self.last_kid_refresh_time),
                )
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="invalid or expired token",
                    headers={"WWW-Authenticate": "Bearer"},
                )

            # Perform refresh for unknown kid
            self.last_kid_refresh_time = now
            try:
                self.jwk_set = await self._fetch_jwks(client, jwks_url)
                self.last_fetch_time = now
            except Exception as exc:
                logger.warning("Failed to refresh JWKS for unknown kid: %s", type(exc).__name__)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="invalid or expired token",
                    headers={"WWW-Authenticate": "Bearer"},
                ) from exc

            key = self._find_key_by_kid(kid)
            if key is not None:
                return key.key

            logger.warning("Key with kid '%s' not found after JWKS refresh", kid)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )

    def _find_key_by_kid(self, kid: str) -> Any | None:
        """Find a PyJWK by kid in the loaded keyset."""
        if not self.jwk_set:
            return None
        for k in self.jwk_set.keys:
            if getattr(k, "key_id", None) == kid:
                return k
        return None

    async def check_health(self, client: httpx.AsyncClient, jwks_url: str) -> bool:
        """Check if JWKS endpoint can be reached and parsed."""
        try:
            await self._fetch_jwks(client, jwks_url)
            return True
        except Exception as exc:
            logger.warning("JWKS health check failed: %s", type(exc).__name__)
            return False


# Global JWKS cache singleton
jwks_cache = JWKSCache()


def _parse_role(role_claim: Any) -> Role | None:
    """Parse role string into Role enum or return None for null/unknown values."""
    from app.core.deps import Role

    if not role_claim or not isinstance(role_claim, str):
        return None
    try:
        return Role(role_claim)
    except ValueError:
        return None


async def verify_jwt_token(
    token: str,
    client: httpx.AsyncClient,
    settings: Settings,
) -> AuthenticatedUser:
    """
    Cryptographically verify Supabase JWT using ES256 and project JWKS.
    Enforces expiration, audience, issuer, leeway, and required claims.
    """
    public_key = await jwks_cache.get_key_for_token(
        token=token,
        client=client,
        jwks_url=settings.SUPABASE_JWKS_URL,
        ttl_seconds=settings.JWKS_CACHE_TTL_SECONDS,
    )

    try:
        payload = jwt.decode(
            token,
            key=public_key,
            algorithms=["ES256"],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.jwt_issuer,
            leeway=30,
            options={
                "require": ["sub", "exp", "aud", "iss"],
                "verify_signature": True,
                "verify_exp": True,
                "verify_iat": True,
                "verify_aud": True,
                "verify_iss": True,
            },
        )
    except jwt.ExpiredSignatureError as exc:
        logger.warning("JWT verification failed: token has expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except (jwt.InvalidAudienceError, jwt.InvalidIssuerError) as exc:
        logger.warning("JWT verification failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except jwt.InvalidSignatureError as exc:
        logger.warning("JWT verification failed: invalid signature")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    except Exception as exc:
        logger.warning("JWT verification failed: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user_id = payload.get("sub")
    if not user_id:
        logger.warning("JWT verification failed: missing sub claim")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Note: 'user_role' is our custom claim; 'role' is the PostgREST connection role
    user_role = _parse_role(payload.get("user_role"))
    email = payload.get("email")

    return AuthenticatedUser(
        user_id=str(user_id),
        email=str(email) if email else None,
        user_role=user_role,
        raw_claims=payload,
    )
