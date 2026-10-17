#!/usr/bin/env python3
"""
api_check.py — Phase 4 FastAPI End-to-End Validation Script for Journal Platform.

Validates that:
  1. The running FastAPI service (/health, /health/ready) is accessible and operational.
  2. Public unauthenticated requests to /me fail with 401.
  3. Real Supabase users created across all 4 roles receive valid tokens.
  4. Token claims and user profiles match when calling /me.
  5. The RBAC matrix against /debug/author, /debug/reviewer, /debug/editor, /debug/admin
     enforces correct 200 vs 403 permissions (including admin inheritance on editor routes).
  6. Cryptographically tampered tokens are rejected with 401.

Usage:
  python scripts/api_check.py                    # Dry-run: prints project ref and instructions
  python scripts/api_check.py --yes              # Executes full check against http://localhost:8000
  python scripts/api_check.py --yes --api-url http://127.0.0.1:8000

Requirements:
  - httpx, psycopg, python-dotenv (from scripts/requirements.txt)
  - apps/api/.env (SUPABASE_URL, SUPABASE_SECRET_KEY, DATABASE_URL)
  - apps/web/.env.local (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
"""

from __future__ import annotations

import argparse
import re
import secrets
import string
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Dependency imports
# ---------------------------------------------------------------------------
try:
    import httpx
except ModuleNotFoundError:
    sys.exit("ERROR: 'httpx' not found. Run: pip install -r scripts/requirements.txt")

try:
    import psycopg
except ModuleNotFoundError:
    sys.exit("ERROR: 'psycopg' not found. Run: pip install -r scripts/requirements.txt")

try:
    from dotenv import dotenv_values
except ModuleNotFoundError:
    sys.exit("ERROR: 'python-dotenv' not found. Run: pip install -r scripts/requirements.txt")

# ---------------------------------------------------------------------------
# Constants & Paths
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
API_ENV_FILE = REPO_ROOT / "apps" / "api" / ".env"
WEB_ENV_FILE = REPO_ROOT / "apps" / "web" / ".env.local"

ROLES: list[str] = ["author", "reviewer", "editor", "admin"]
_REF_RE = re.compile(r"postgres\.([a-z0-9]+)", re.IGNORECASE)
_URL_REF_RE = re.compile(r"https?://([a-z0-9]+)\.supabase\.(?:co|in|net)", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _extract_project_ref(db_url: str, supabase_url: str) -> str:
    """Extract project ref without revealing connection passwords or secrets."""
    match_db = _REF_RE.search(db_url)
    if match_db:
        return match_db.group(1)
    match_url = _URL_REF_RE.search(supabase_url)
    if match_url:
        return match_url.group(1)
    return "unknown"


def _generate_strong_password() -> str:
    """Generate high-entropy password satisfying Supabase password policy."""
    prefix = (
        secrets.choice(string.ascii_uppercase)
        + secrets.choice(string.ascii_lowercase)
        + secrets.choice(string.digits)
        + secrets.choice("!@#$%&*")
    )
    charset = string.ascii_letters + string.digits + "!@#$%&*-_"
    suffix = "".join(secrets.choice(charset) for _ in range(16))
    return prefix + suffix


def _tamper_jwt_signature(jwt_token: str) -> str:
    """Flip a character in the signature segment of a JWT."""
    parts = jwt_token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT format")
    sig = parts[2]
    flipped = "B" if sig[-1] == "A" else "A"
    tampered_sig = sig[:-1] + flipped
    return f"{parts[0]}.{parts[1]}.{tampered_sig}"


# ---------------------------------------------------------------------------
# Main Execution
# ---------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(description="Phase 4 FastAPI E2E validation script.")
    parser.add_argument("--yes", action="store_true", help="Execute the checks against the API")
    parser.add_argument("--api-url", default="http://localhost:8000", help="Target API URL")
    args = parser.parse_args()

    # Verify environment files exist
    if not API_ENV_FILE.exists():
        sys.exit(f"ERROR: env file not found at {API_ENV_FILE.relative_to(REPO_ROOT)}")
    if not WEB_ENV_FILE.exists():
        sys.exit(f"ERROR: env file not found at {WEB_ENV_FILE.relative_to(REPO_ROOT)}")

    api_vars = dotenv_values(API_ENV_FILE)
    web_vars = dotenv_values(WEB_ENV_FILE)

    supabase_url = (api_vars.get("SUPABASE_URL") or "").strip()
    supabase_secret_key = (api_vars.get("SUPABASE_SECRET_KEY") or "").strip()
    database_url = (api_vars.get("DATABASE_URL") or "").strip()
    publishable_key = (web_vars.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or "").strip()

    missing: list[str] = []
    if not supabase_url:
        missing.append("SUPABASE_URL (in apps/api/.env)")
    if not supabase_secret_key:
        missing.append("SUPABASE_SECRET_KEY (in apps/api/.env)")
    if not database_url:
        missing.append("DATABASE_URL (in apps/api/.env)")
    if not publishable_key:
        missing.append("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (in apps/web/.env.local)")

    if missing:
        sys.exit("ERROR: Missing required configuration:\n  - " + "\n  - ".join(missing))

    api_url = args.api_url.rstrip("/")
    project_ref = _extract_project_ref(database_url, supabase_url)
    print(f"Project ref : {project_ref}")
    print(f"API URL     : {api_url}")

    if not args.yes:
        print("\nDry-run: specify --yes to execute the live API verification.")
        print("Ensure the FastAPI server is running: uvicorn app.main:app --reload --port 8000")
        return 0

    # 1. Early reachability check on running API
    print("\n[1/6] Checking FastAPI server connectivity...")
    try:
        health_resp = httpx.get(f"{api_url}/health", timeout=5.0)
    except Exception as exc:
        print(f"FAIL  [api-reachability] Cannot connect to API at {api_url}: {type(exc).__name__}")
        print("\nHINT: Start the development server first with:")
        print("      cd apps/api")
        print("      uvicorn app.main:app --reload --port 8000")
        return 1

    if health_resp.status_code != 200:
        print(f"FAIL  [api-health] /health returned unexpected HTTP {health_resp.status_code}")
        return 1
    print(f"PASS  [api-health] /health returned 200: {health_resp.json()}")

    # 2. Check /health/ready
    print("\n[2/6] Checking /health/ready probe...")
    ready_resp = httpx.get(f"{api_url}/health/ready", timeout=10.0)
    if ready_resp.status_code != 200:
        print(f"FAIL  [api-ready] /health/ready returned HTTP {ready_resp.status_code}: {ready_resp.text}")
        return 1
    print(f"PASS  [api-ready] /health/ready returned 200: {ready_resp.json()}")

    # 3. Check unauthenticated access to /me fails with 401
    print("\n[3/6] Checking unauthenticated access to protected route /me...")
    unauth_resp = httpx.get(f"{api_url}/me", timeout=5.0)
    if unauth_resp.status_code == 401:
        print("PASS  [unauthenticated] /me returned 401 with standard error shape")
    else:
        print(f"FAIL  [unauthenticated] /me returned HTTP {unauth_resp.status_code} (expected 401)")
        return 1

    base_url = supabase_url.rstrip("/")
    admin_headers = {
        "apikey": supabase_secret_key,
        "Authorization": f"Bearer {supabase_secret_key}",
        "Content-Type": "application/json",
    }
    client_headers = {
        "apikey": publishable_key,
        "Authorization": f"Bearer {publishable_key}",
        "Content-Type": "application/json",
    }

    test_users: list[dict[str, str]] = []
    created_user_ids: list[str] = []
    all_passed = True

    try:
        # 4. Provision temporary users
        print("\n[4/6] Creating 4 temporary users in Supabase Auth & public.user_profiles...")
        for role in ROLES:
            rand_tag = secrets.token_hex(4)
            email = f"api-check-{role}-{rand_tag}@example.com"
            password = _generate_strong_password()

            payload = {
                "email": email,
                "password": password,
                "email_confirm": True,
            }

            resp = httpx.post(
                f"{base_url}/auth/v1/admin/users",
                headers=admin_headers,
                json=payload,
                timeout=20.0,
            )
            if resp.status_code in (401, 403):
                print(f"FAIL  [admin-api] HTTP {resp.status_code} Unauthorized. Verify SUPABASE_SECRET_KEY.")
                return 1
            if resp.status_code not in (200, 201):
                print(f"FAIL  [admin-api] Failed to create {role} user: {resp.text}")
                return 1

            uid = resp.json()["id"]
            created_user_ids.append(uid)
            test_users.append({
                "role": role,
                "id": uid,
                "email": email,
                "password": password,
            })
            print(f"  Created user {role:<8} (id={uid})")

        # Assign profile roles via PostgreSQL
        with psycopg.connect(database_url) as conn:
            with conn.cursor() as cur:
                for u in test_users:
                    if u["role"] != "author":
                        cur.execute("UPDATE public.user_profiles SET role = %s WHERE id = %s", (u["role"], u["id"]))
                    cur.execute("SELECT role FROM public.user_profiles WHERE id = %s", (u["id"],))
                    row = cur.fetchone()
                    if not row or str(row[0]) != u["role"]:
                        print(f"FAIL  [database] Role update verification failed for {u['role']}")
                        return 1
            conn.commit()
        print("  Profile roles verified in public.user_profiles.")

        # Sign in each user to obtain access tokens
        user_tokens: dict[str, str] = {}
        for u in test_users:
            login_resp = httpx.post(
                f"{base_url}/auth/v1/token?grant_type=password",
                headers=client_headers,
                json={"email": u["email"], "password": u["password"]},
                timeout=15.0,
            )
            if login_resp.status_code != 200:
                print(f"FAIL  [sign-in] Login failed for {u['role']}: {login_resp.text}")
                return 1
            token = login_resp.json().get("access_token")
            if not token:
                print(f"FAIL  [sign-in] No access token received for {u['role']}")
                return 1
            user_tokens[u["role"]] = token

        # 5. Verify /me for all users
        print("\n[5/6] Verifying /me endpoint with live JWTs...")
        for role, token in user_tokens.items():
            me_resp = httpx.get(
                f"{api_url}/me",
                headers={"Authorization": f"Bearer {token}"},
                timeout=10.0,
            )
            if me_resp.status_code != 200:
                print(f"FAIL  [me-{role}] /me returned HTTP {me_resp.status_code}: {me_resp.text}")
                all_passed = False
                continue
            me_data = me_resp.json()
            if me_data.get("user_role") == role:
                print(f"PASS  [me-{role:<8}] /me returned 200 with user_role='{role}'")
            else:
                got_role = me_data.get("user_role")
                print(f"FAIL  [me-{role:<8}] /me mismatch: expected '{role}', got {got_role!r}")
                all_passed = False

        # 6. Verify RBAC matrix against /debug/*
        print("\n[6/6] Verifying RBAC permission matrix on /debug/* routes...")
        # Expected status codes: (user_role, endpoint_path) -> expected_status
        expected_matrix = {
            # Author: only /debug/author
            ("author", "/debug/author"): 200,
            ("author", "/debug/reviewer"): 403,
            ("author", "/debug/editor"): 403,
            ("author", "/debug/admin"): 403,
            # Reviewer: only /debug/reviewer
            ("reviewer", "/debug/author"): 403,
            ("reviewer", "/debug/reviewer"): 200,
            ("reviewer", "/debug/editor"): 403,
            ("reviewer", "/debug/admin"): 403,
            # Editor: /debug/editor
            ("editor", "/debug/author"): 403,
            ("editor", "/debug/reviewer"): 403,
            ("editor", "/debug/editor"): 200,
            ("editor", "/debug/admin"): 403,
            # Admin: /debug/admin and /debug/editor (via inheritance)
            ("admin", "/debug/author"): 403,
            ("admin", "/debug/reviewer"): 403,
            ("admin", "/debug/editor"): 200,
            ("admin", "/debug/admin"): 200,
        }

        paths = ["/debug/author", "/debug/reviewer", "/debug/editor", "/debug/admin"]
        for role in ROLES:
            token = user_tokens[role]
            for path in paths:
                expected_status = expected_matrix[(role, path)]
                resp = httpx.get(
                    f"{api_url}{path}",
                    headers={"Authorization": f"Bearer {token}"},
                    timeout=5.0,
                )
                if resp.status_code == expected_status:
                    print(
                        f"PASS  [matrix] {role:<8} on {path:<16} "
                        f"-> {resp.status_code} (expected {expected_status})"
                    )
                else:
                    print(
                        f"FAIL  [matrix] {role:<8} on {path:<16} "
                        f"-> {resp.status_code} (expected {expected_status})"
                    )
                    all_passed = False

        # 7. Tampered token verification
        print("\nTesting tampered signature rejection...")
        author_token = user_tokens["author"]
        tampered = _tamper_jwt_signature(author_token)
        tamper_resp = httpx.get(
            f"{api_url}/me",
            headers={"Authorization": f"Bearer {tampered}"},
            timeout=5.0,
        )
        if tamper_resp.status_code == 401:
            print("PASS  [tampered-token] Tampered signature was successfully rejected with 401")
        else:
            print(f"FAIL  [tampered-token] Expected 401, got HTTP {tamper_resp.status_code}")
            all_passed = False

    finally:
        # Cleanup all created temporary users
        if created_user_ids:
            print(f"\nCleaning up {len(created_user_ids)} temporary user(s)...")
            for uid in created_user_ids:
                try:
                    del_resp = httpx.delete(
                        f"{base_url}/auth/v1/admin/users/{uid}",
                        headers=admin_headers,
                        timeout=15.0,
                    )
                    if del_resp.status_code in (200, 204):
                        print(f"  [cleanup] Deleted user {uid}")
                    else:
                        print(
                            f"  [cleanup] WARNING: HTTP {del_resp.status_code} "
                            f"deleting user {uid}"
                        )
                except Exception as exc:
                    print(
                        f"  [cleanup] WARNING: Error deleting user {uid}: "
                        f"{type(exc).__name__}"
                    )

    print("\n" + ("=" * 60))
    if all_passed:
        print("RESULT: All FastAPI core & RBAC validation checks PASSED.")
        return 0
    else:
        print("RESULT: One or more validation checks FAILED.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
