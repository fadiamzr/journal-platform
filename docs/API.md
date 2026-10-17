# FastAPI Backend Core API & Security Specification

This document details the architecture, configuration, security model, token verification mechanics, and route contracts for the **Journal Platform FastAPI backend** (`apps/api`).

---

## 1. Environment Configuration

Settings are managed via Pydantic Settings and automatically loaded from `apps/api/.env`.

| Variable | Type | Default | Required | Description |
|---|---|---|---|---|
| `APP_ENV` | String | `development` | No | Application environment (`development` or `production`). Debug routes exist only in development. |
| `LOG_LEVEL` | String | `INFO` | No | Logging verbosity (`DEBUG`, `INFO`, `WARNING`, `ERROR`). |
| `SUPABASE_URL` | String | — | **Yes** | Base URL for your Supabase project (e.g. `https://<ref>.supabase.co`). |
| `SUPABASE_SECRET_KEY` | SecretStr | — | **Yes** | Supabase Secret API key ("new-format secret key" or service role key). Used only in `apikey` header. |
| `SUPABASE_JWKS_URL` | String | — | **Yes** | Supabase Auth JWKS endpoint (`https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`). |
| `JWT_AUDIENCE` | String | `authenticated` | No | Expected JWT `aud` claim for authenticated Supabase users. |
| `JWKS_CACHE_TTL_SECONDS` | Integer | `600` | No | Duration (in seconds) to cache fetched public JWKS in memory. |
| `CORS_ORIGINS` | String | `""` | No | Comma-delimited list of permitted CORS browser origins. |
| `MAX_UPLOAD_MB` | Integer | `50` | No | Maximum allowed payload upload size in megabytes. |
| `DATABASE_URL` | SecretStr | `None` | No | PostgreSQL connection URI for administrative or batch operations. |
| `LLM_PROVIDER` | String | `None` | No | AI provider identifier (optional in Phase 4). |
| `GEMINI_API_KEY` | SecretStr | `None` | No | Gemini API key (optional in Phase 4). |
| `GEMINI_MODEL` | String | `None` | No | Target Gemini model name (optional in Phase 4). |

> [!IMPORTANT]
> If any required configuration variables (`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `SUPABASE_JWKS_URL`) are missing or empty on startup, the application terminates immediately with a clear error listing the **variable names only**, preventing credential leakage.

---

## 2. JWT Verification & Cryptographic Security

Supabase Auth signs user access tokens using asymmetric cryptography (ECC P-256 / ES256). The FastAPI backend verifies every incoming token directly against Supabase's published JWKS without requiring a database query.

### Verification Lifecycle
1. **Algorithm Lockdown**:
   - Verification accepts **`ES256` ONLY**.
   - PyJWT strictly rejects `none`, `HS256`, `RS256`, or any other algorithm. This entirely eliminates algorithm-confusion attacks (e.g. attempting to sign an HMAC token using the public key as the secret).
2. **JWKS Key Resolution**:
   - The token header `kid` (Key ID) is matched against the in-memory keyset.
   - Keyset is cached in memory for `JWKS_CACHE_TTL_SECONDS` (default: 10 minutes), preventing repetitive network round-trips.
3. **Unknown `kid` Rate-Limiting**:
   - If a token contains a `kid` not present in the cached JWKS (e.g. during a key rotation), the service will refresh the JWKS **once**.
   - To defend against denial-of-service (DoS) attacks where an attacker floods requests with random `kid` values, JWKS refresh for unknown keys is rate-limited to **at most once per 60 seconds**.
4. **Claim Validation**:
   - `iss` (Issuer): Must match `{SUPABASE_URL}/auth/v1`.
   - `aud` (Audience): Must match `JWT_AUDIENCE` (`authenticated`).
   - `exp` (Expiration) & `iat` (Issued At): Enforced with a 30-second clock skew tolerance (`leeway = 30`).
   - Required claims: `sub`, `exp`, `aud`, `iss`.

---

## 3. Authorization Model: 401 vs 403 & Role Semantics

### 401 Unauthorized vs 403 Forbidden
The platform enforces a clear, unambiguous boundary between authentication failures and permission denials:

| Status Code | Reason | Response Details |
|---|---|---|
| **401 Unauthorized** | Token is missing, malformed, expired, has invalid signature, invalid audience/issuer, or uses an untrusted key. | Always includes `WWW-Authenticate: Bearer` header. Returns generic message `"invalid or expired token"`. Internal logger records root cause without token. |
| **403 Forbidden** | Token is valid, but authenticated user lacks required platform permissions. | Returns message `"forbidden: insufficient permissions"`. |

### Role Hierarchy & Semantics
Roles are authored in PostgreSQL enum `public.user_role` (`author`, `reviewer`, `editor`, `admin`) and embedded in the token's top-level `user_role` claim by the custom hook.

- **Admin Inheritance**: Administrators (`admin`) automatically inherit access to all routes permitting editors (`editor`).
- **Exact Matching**: Other roles (`author`, `reviewer`, `admin`) require an exact match unless explicitly grouped.
- **Null / Missing Role**: If `user_role` is `null` or unassigned, the user can authenticate (`/me` succeeds with `user_role: null`), but **all role-guarded endpoints immediately reject with 403**.

---

## 4. Centralized Uniform Error Shape

All application errors—including HTTP exceptions, Pydantic validation errors, and unhandled server exceptions—are serialized into a consistent, predictable JSON schema:

```json
{
  "error": {
    "code": "unauthorized",
    "message": "invalid or expired token",
    "request_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
  }
}
```

### Common Error Codes
- `unauthorized` (401): Missing, malformed, or invalid bearer token.
- `forbidden` (403): Role or permission check failed.
- `not_found` (404): Endpoint or entity not found.
- `validation_error` (422): Request schema or parameter validation failure.
- `internal_error` (500): Unhandled exception (stack trace logged internally, never returned).
- `service_unavailable` (503): Readiness probe failed (e.g. JWKS or Auth unreachable).

---

## 5. Route Table

| Method | Path | Auth Required | Allowed Roles | Description |
|---|---|---|---|---|
| `GET` | `/health` | No | Public | Liveness probe; returns service status, environment, and version. |
| `GET` | `/health/ready` | No | Public | Readiness probe; checks JWKS and Supabase Auth connectivity. Returns 200 or 503. |
| `GET` | `/me` | Yes (Bearer) | Any authenticated | Returns user ID, email, role from JWT, and profile from database. |
| `GET` | `/debug/author` | Yes (Bearer) | `author` | **Development only**: Tests author access guard. |
| `GET` | `/debug/reviewer` | Yes (Bearer) | `reviewer` | **Development only**: Tests reviewer access guard. |
| `GET` | `/debug/editor` | Yes (Bearer) | `editor`, `admin` | **Development only**: Tests editor access guard (permits admin). |
| `GET` | `/debug/admin` | Yes (Bearer) | `admin` | **Development only**: Tests strict admin access guard. |

> [!NOTE]
> All `/debug/*` routes are conditionally registered **only** when `APP_ENV=development`. In production (`APP_ENV=production`), these routes are omitted entirely, returning 404 Not Found.

---

## 6. Tracing & Logging Redaction

- **Request ID Echo**: Every request is assigned a unique `X-Request-ID` (either adopted from incoming headers if sanitized, or newly generated via UUID4). The ID is reflected in the response headers and attached to every log record.
- **Sensitive String Scrubbing**: The logging pipeline employs a `RedactingFilter` that scrubs Bearer tokens, Supabase API keys (<secret-key>, <publishable-key>), raw JWT signatures, and database URLs containing passwords, replacing them with `[REDACTED]`.
