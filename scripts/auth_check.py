#!/usr/bin/env python3
"""
auth_check.py — Phase 3 Auth & RBAC validation script for Journal Platform.

Validates that:
  1. The Auth Admin API can create users across all 4 platform roles.
  2. Public user_profiles rows exist and roles can be updated via database connection.
  3. User authentication (password grant) succeeds.
  4. Access tokens contain:
     - user_role matching the assigned profile role ('author', 'reviewer', 'editor', 'admin')
     - role = 'authenticated' (standard PostgREST connection role preserved)
     - sub = user_id
  5. The custom_access_token_hook is properly executed and reflected in issued JWTs.

Usage:
  python scripts/auth_check.py          # Dry-run: prints project ref and exits
  python scripts/auth_check.py --yes    # Executes full auth check against Supabase

Requirements:
  - httpx, python-dotenv, psycopg (from scripts/requirements.txt)
  - SUPABASE_URL, SUPABASE_SECRET_KEY, DATABASE_URL in apps/api/.env
  - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in apps/web/.env.local
"""

from __future__ import annotations

import base64
import json
import re
import secrets
import string
import sys
from pathlib import Path
from typing import Any

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
    """Extract project ref from DATABASE_URL username or SUPABASE_URL hostname."""
    match_db = _REF_RE.search(db_url)
    if match_db:
        return match_db.group(1)
    match_url = _URL_REF_RE.search(supabase_url)
    if match_url:
        return match_url.group(1)
    return "unknown"


def _generate_strong_password() -> str:
    """Generate a high-entropy random password satisfying strict password policies."""
    prefix = (
        secrets.choice(string.ascii_uppercase)
        + secrets.choice(string.ascii_lowercase)
        + secrets.choice(string.digits)
        + secrets.choice("!@#$%&*")
    )
    charset = string.ascii_letters + string.digits + "!@#$%&*-_"
    suffix = "".join(secrets.choice(charset) for _ in range(16))
    return prefix + suffix


def _decode_unverified_jwt_payload(jwt_token: str) -> dict[str, Any]:
    """Base64url-decode the access token payload without verifying signature."""
    parts = jwt_token.split(".")
    if len(parts) != 3:
        raise ValueError(f"Invalid JWT structure: expected 3 segments, got {len(parts)}")
    payload_b64 = parts[1]
    rem = len(payload_b64) % 4
    if rem > 0:
        payload_b64 += "=" * (4 - rem)
    payload_bytes = base64.urlsafe_b64decode(payload_b64.encode("ascii"))
    return json.loads(payload_bytes.decode("utf-8"))


# ---------------------------------------------------------------------------
# Main Execution
# ---------------------------------------------------------------------------
def main() -> int:
    wants_run = "--yes" in sys.argv[1:]

    # Check env file existence
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

    # Validate required vars are present without leaking any values
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

    # Extract and display project ref only
    project_ref = _extract_project_ref(database_url, supabase_url)
    print(f"Project ref : {project_ref}")

    if not wants_run:
        print("\nDry-run: specify --yes to execute the auth check.")
        return 0

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
    user_roles_seen: list[str | None] = []

    try:
        print("\nCreating 4 temporary test users via Auth Admin API...")
        for role in ROLES:
            rand_tag = secrets.token_hex(4)
            email = f"auth-check-{role}-{rand_tag}@example.com"
            password = _generate_strong_password()

            payload = {
                "email": email,
                "password": password,
                "email_confirm": True,
            }

            try:
                resp = httpx.post(
                    f"{base_url}/auth/v1/admin/users",
                    headers=admin_headers,
                    json=payload,
                    timeout=20.0,
                )
            except Exception as exc:
                print(f"FAIL  [admin-api] network error creating {role} user: {type(exc).__name__}")
                return 1

            if resp.status_code in (401, 403):
                print(
                    f"FAIL  [admin-api] HTTP {resp.status_code} Unauthorized. "
                    "The SUPABASE_SECRET_KEY in apps/api/.env is invalid or lacks admin privileges."
                )
                return 1

            if resp.status_code not in (200, 201):
                print(f"FAIL  [admin-api] failed to create {role} user (HTTP {resp.status_code}): {resp.text}")
                return 1

            user_data = resp.json()
            user_id = user_data.get("id")
            if not user_id:
                print(f"FAIL  [admin-api] user creation response missing 'id' for {role}")
                return 1

            created_user_ids.append(user_id)
            test_users.append({
                "role": role,
                "id": user_id,
                "email": email,
                "password": password,
            })
            print(f"  Created temporary {role:<8} user (id={user_id})")

        # -----------------------------------------------------------------------
        # Assign and verify roles in public.user_profiles
        # -----------------------------------------------------------------------
        print("\nConfiguring roles in public.user_profiles...")
        try:
            with psycopg.connect(database_url) as conn:
                with conn.cursor() as cur:
                    for u in test_users:
                        role = u["role"]
                        uid = u["id"]
                        if role != "author":
                            cur.execute(
                                "UPDATE public.user_profiles SET role = %s WHERE id = %s",
                                (role, uid),
                            )
                        # Verify profile row exists
                        cur.execute(
                            "SELECT role FROM public.user_profiles WHERE id = %s",
                            (uid,),
                        )
                        row = cur.fetchone()
                        if not row:
                            print(f"FAIL  [database] user_profiles row missing for user {uid}")
                            return 1
                        actual_role = str(row[0])
                        if actual_role != role:
                            print(
                                f"FAIL  [database] role mismatch for user {uid}: "
                                f"expected {role}, got {actual_role}"
                            )
                            return 1
                conn.commit()
            print("  Profiles verified and roles assigned successfully.")
        except Exception as exc:
            print(f"FAIL  [database] connection or query failed: {type(exc).__name__}: {exc}")
            return 1

        # -----------------------------------------------------------------------
        # Sign in each user and verify token claims
        # -----------------------------------------------------------------------
        print("\nSigning in users and verifying access token claims...")
        for u in test_users:
            expected_role = u["role"]
            sign_in_payload = {
                "email": u["email"],
                "password": u["password"],
            }

            try:
                resp = httpx.post(
                    f"{base_url}/auth/v1/token?grant_type=password",
                    headers=client_headers,
                    json=sign_in_payload,
                    timeout=20.0,
                )
            except Exception as exc:
                print(f"FAIL  [{expected_role}] sign-in network error: {type(exc).__name__}")
                all_passed = False
                continue

            if resp.status_code != 200:
                print(f"FAIL  [{expected_role}] sign-in failed (HTTP {resp.status_code}): {resp.text}")
                all_passed = False
                continue

            token_data = resp.json()
            access_token = token_data.get("access_token")
            if not access_token:
                print(f"FAIL  [{expected_role}] sign-in response did not contain access_token")
                all_passed = False
                continue

            try:
                payload = _decode_unverified_jwt_payload(access_token)
            except Exception as exc:
                print(f"FAIL  [{expected_role}] failed to decode JWT payload: {exc}")
                all_passed = False
                continue

            token_user_role = payload.get("user_role")
            token_pg_role = payload.get("role")
            token_sub = payload.get("sub")
            user_roles_seen.append(token_user_role)

            checks_ok = True
            mismatches: list[str] = []

            if token_user_role != expected_role:
                checks_ok = False
                mismatches.append(f"user_role: expected '{expected_role}', got {token_user_role!r}")
            if token_pg_role != "authenticated":
                checks_ok = False
                mismatches.append(f"role: expected 'authenticated', got {token_pg_role!r}")
            if token_sub != u["id"]:
                checks_ok = False
                mismatches.append(f"sub: expected '{u['id']}', got {token_sub!r}")

            if checks_ok:
                print(
                    f"PASS  [{expected_role:<8}] user_role='{token_user_role}', "
                    f"role='{token_pg_role}', sub={token_sub}  (decoded, not signature-verified)"
                )
            else:
                all_passed = False
                print(f"FAIL  [{expected_role:<8}] claim verification failed: {'; '.join(mismatches)}")
                print("      (decoded, not signature-verified)")

        # Hint check: if user_role was missing from every token
        if user_roles_seen and all(r is None for r in user_roles_seen):
            print("\nHINT: the hook is not enabled in the dashboard yet.")
            print("      Enable it in Supabase Dashboard: Authentication > Hooks > Customize Access Token (JWT) Claims.")
            print("      Target: schema 'public', function 'custom_access_token_hook'.")
            print("      See docs/AUTH.md for full step-by-step instructions.")

    finally:
        # -----------------------------------------------------------------------
        # Cleanup: Delete all temporary users (profiles cascade)
        # -----------------------------------------------------------------------
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
                        print(f"  [cleanup] WARNING: HTTP {del_resp.status_code} deleting user {uid}")
                except Exception as exc:
                    print(f"  [cleanup] WARNING: error deleting user {uid}: {type(exc).__name__}")

    print("\n" + ("=" * 60))
    if all_passed:
        print("RESULT: All Auth & RBAC checks PASSED.")
        return 0
    else:
        print("RESULT: One or more Auth & RBAC checks FAILED.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
