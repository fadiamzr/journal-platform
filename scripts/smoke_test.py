"""
smoke_test.py — Phase 1 validation script for Journal Platform.

Reads apps/api/.env (NOT .env.example) and checks:
  a) Required env vars are present and non-empty
  b) JWKS URL returns 200 and contains at least one key
  c) Supabase Storage buckets exist
  d) Gemini REST API responds to a trivial prompt
  e) Postgres connection succeeds (skipped if psycopg unavailable)

Run from the repo root or the scripts/ directory:
  python scripts/smoke_test.py

Exits with code 0 only if all applicable checks PASS (SKIP is not a failure).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Locate and load apps/api/.env
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
ENV_FILE = REPO_ROOT / "apps" / "api" / ".env"

try:
    from dotenv import load_dotenv
except ImportError:
    print("FAIL  [setup] python-dotenv is not installed. Run: pip install -r requirements.txt")
    sys.exit(1)

if not ENV_FILE.exists():
    print(f"FAIL  [setup] {ENV_FILE} not found.")
    print("      Copy apps/api/.env.example to apps/api/.env and fill in real values.")
    sys.exit(1)

load_dotenv(ENV_FILE, override=False)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_failures: list[str] = []


def _pass(check: str, detail: str = "") -> None:
    suffix = f"  ({detail})" if detail else ""
    print(f"PASS  [{check}]{suffix}")


def _fail(check: str, detail: str = "") -> None:
    suffix = f"  ({detail})" if detail else ""
    print(f"FAIL  [{check}]{suffix}")
    _failures.append(check)


def _skip(check: str, reason: str) -> None:
    print(f"SKIP  [{check}]  {reason}")


def _env(name: str) -> str:
    """Return env var value without printing it."""
    return os.environ.get(name, "")


# ---------------------------------------------------------------------------
# Check a — Required env vars
# ---------------------------------------------------------------------------

REQUIRED_VARS = [
    "SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_JWKS_URL",
    "DATABASE_URL",
    "LLM_PROVIDER",
    "GEMINI_API_KEY",
    "GEMINI_MODEL",
    "CORS_ORIGINS",
    "MAX_UPLOAD_MB",
]


def check_env_vars() -> None:
    missing = [v for v in REQUIRED_VARS if not _env(v).strip()]
    if missing:
        # Print variable *names* only — never values
        _fail("env-vars", f"missing or empty: {', '.join(missing)}")
    else:
        _pass("env-vars", f"all {len(REQUIRED_VARS)} required vars present")


# ---------------------------------------------------------------------------
# Check b — JWKS URL
# ---------------------------------------------------------------------------

def check_jwks() -> None:
    import httpx

    url = _env("SUPABASE_JWKS_URL")
    if not url:
        _skip("jwks", "SUPABASE_JWKS_URL not set (covered by check a)")
        return

    try:
        resp = httpx.get(url, timeout=10)
    except Exception as exc:
        _fail("jwks", f"request error: {type(exc).__name__}")
        return

    if resp.status_code != 200:
        _fail("jwks", f"HTTP {resp.status_code}")
        return

    try:
        data = resp.json()
        keys = data.get("keys", [])
    except Exception:
        _fail("jwks", "response is not valid JSON")
        return

    if not keys:
        _fail("jwks", "response contains no keys")
    else:
        _pass("jwks", f"{len(keys)} key(s) found")


# ---------------------------------------------------------------------------
# Check c — Storage buckets
# ---------------------------------------------------------------------------

EXPECTED_BUCKETS = ["manuscripts", "manuscripts-anonymized", "published"]


def check_storage() -> None:
    import httpx

    base_url = _env("SUPABASE_URL").rstrip("/")
    secret_key = _env("SUPABASE_SECRET_KEY")

    if not base_url or not secret_key:
        _skip("storage", "SUPABASE_URL or SUPABASE_SECRET_KEY not set (covered by check a)")
        return

    endpoint = f"{base_url}/storage/v1/bucket"
    headers = {"apikey": secret_key}

    try:
        resp = httpx.get(endpoint, headers=headers, timeout=10)
    except Exception as exc:
        _fail("storage", f"request error: {type(exc).__name__}")
        return

    if resp.status_code == 401:
        _fail(
            "storage",
            "HTTP 401 Unauthorized — SUPABASE_SECRET_KEY may be wrong or have insufficient permissions."
            " Ensure you are using the service_role key, not the anon key.",
        )
        return

    if resp.status_code != 200:
        _fail("storage", f"HTTP {resp.status_code}")
        return

    try:
        buckets_data = resp.json()
        found_names = {b.get("name", "") for b in buckets_data}
    except Exception:
        _fail("storage", "response is not valid JSON")
        return

    missing = [b for b in EXPECTED_BUCKETS if b not in found_names]
    if missing:
        _fail("storage", f"missing buckets: {', '.join(missing)}")
    else:
        _pass("storage", f"all {len(EXPECTED_BUCKETS)} buckets found")


# ---------------------------------------------------------------------------
# Check d — Gemini REST API
# ---------------------------------------------------------------------------

def check_gemini() -> None:
    import httpx

    api_key = _env("GEMINI_API_KEY")
    model = _env("GEMINI_MODEL") or "gemini-3.5-flash-lite"

    if not api_key:
        _skip("gemini", "GEMINI_API_KEY not set (covered by check a)")
        return

    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    )
    headers = {"x-goog-api-key": api_key, "Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": "Reply with exactly: OK"}]}],
        "generationConfig": {"maxOutputTokens": 8},
    }

    try:
        resp = httpx.post(url, headers=headers, json=payload, timeout=20)
    except Exception as exc:
        _fail("gemini", f"request error: {type(exc).__name__}")
        return

    if resp.status_code == 401:
        _fail("gemini", "HTTP 401 — GEMINI_API_KEY is invalid or expired")
        return

    if resp.status_code == 404:
        _fail("gemini", f"HTTP 404 — model '{model}' not found (check GEMINI_MODEL)")
        return

    if resp.status_code != 200:
        _fail("gemini", f"HTTP {resp.status_code}")
        return

    try:
        data = resp.json()
        _ = data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, Exception):
        _fail("gemini", "unexpected response shape — no candidate text returned")
        return

    _pass("gemini", f"model={model} responded successfully")


# ---------------------------------------------------------------------------
# Check e — Postgres connection
# ---------------------------------------------------------------------------

def check_database() -> None:
    try:
        import psycopg  # type: ignore[import]
    except ImportError:
        _skip("database", "psycopg not installed — run: pip install psycopg[binary]")
        return

    db_url = _env("DATABASE_URL")
    if not db_url:
        _skip("database", "DATABASE_URL not set (covered by check a)")
        return

    try:
        with psycopg.connect(db_url, connect_timeout=10) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                result = cur.fetchone()
        if result and result[0] == 1:
            _pass("database", "SELECT 1 returned 1")
        else:
            _fail("database", "SELECT 1 returned unexpected result")
    except psycopg.OperationalError as exc:
        # Avoid printing the exc directly as it may contain connection string fragments
        _fail("database", f"OperationalError: {type(exc).__name__} (check DATABASE_URL)")
    except Exception as exc:
        _fail("database", f"{type(exc).__name__} (check DATABASE_URL)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print()
    print("=" * 60)
    print("  Journal Platform — Smoke Test")
    print(f"  env file: {ENV_FILE}")
    print("=" * 60)
    print()

    check_env_vars()
    check_jwks()
    check_storage()
    check_gemini()
    check_database()

    print()
    print("=" * 60)
    if _failures:
        print(f"  RESULT: FAILED ({len(_failures)} check(s) failed: {', '.join(_failures)})")
        print("=" * 60)
        print()
        sys.exit(1)
    else:
        print("  RESULT: ALL CHECKS PASSED")
        print("=" * 60)
        print()
        sys.exit(0)


if __name__ == "__main__":
    main()
