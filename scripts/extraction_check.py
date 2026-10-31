#!/usr/bin/env python3
"""
extraction_check.py — Phase 5 AI Extraction End-to-End Validation Script.

Creates a temporary author user, uploads a real PDF, triggers AI extraction,
polls for completion, prints a summary, and saves the full JSON result.

Usage:
  python scripts/extraction_check.py --yes --pdf path/to/test.pdf
  python scripts/extraction_check.py --yes --pdf path/to/test.pdf --api-url http://localhost:8000

Requirements (from scripts/requirements.txt):
  httpx, psycopg, python-dotenv

Environment files read:
  apps/api/.env          -> SUPABASE_URL, SUPABASE_SECRET_KEY, DATABASE_URL
  apps/web/.env.local    -> NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

The script NEVER prints tokens, keys, passwords, or PDF content.
All created resources are deleted in a finally block.
"""

from __future__ import annotations

import argparse
import json
import re
import secrets
import string
import sys
import tempfile
import time
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
# Constants
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
API_ENV_FILE = REPO_ROOT / "apps" / "api" / ".env"
WEB_ENV_FILE = REPO_ROOT / "apps" / "web" / ".env.local"

POLL_INTERVAL_S = 3
POLL_TIMEOUT_S = 150

_REF_RE = re.compile(r"postgres\.([a-z0-9]+)", re.IGNORECASE)
_URL_REF_RE = re.compile(r"https?://([a-z0-9]+)\.supabase\.(?:co|in|net)", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Helpers copied from api_check.py
# ---------------------------------------------------------------------------

def _extract_project_ref(db_url: str, supabase_url: str) -> str:
    match_db = _REF_RE.search(db_url)
    if match_db:
        return match_db.group(1)
    match_url = _URL_REF_RE.search(supabase_url)
    if match_url:
        return match_url.group(1)
    return "unknown"


def _generate_strong_password() -> str:
    prefix = (
        secrets.choice(string.ascii_uppercase)
        + secrets.choice(string.ascii_lowercase)
        + secrets.choice(string.digits)
        + secrets.choice("!@#$%&*")
    )
    charset = string.ascii_letters + string.digits + "!@#$%&*-_"
    suffix = "".join(secrets.choice(charset) for _ in range(16))
    return prefix + suffix


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Phase 5 AI extraction E2E validation script."
    )
    parser.add_argument("--yes", action="store_true", help="Execute the check")
    parser.add_argument("--pdf", required=True, help="Path to the PDF to upload")
    parser.add_argument("--api-url", default="http://localhost:8000", help="Target API base URL")
    args = parser.parse_args()

    # Verify PDF exists
    pdf_path = Path(args.pdf).resolve()
    if not pdf_path.exists():
        sys.exit(f"ERROR: PDF not found: {pdf_path}")
    if not pdf_path.suffix.lower() == ".pdf":
        sys.exit(f"ERROR: File does not have a .pdf extension: {pdf_path.name}")

    # Verify env files
    for env_file in (API_ENV_FILE, WEB_ENV_FILE):
        if not env_file.exists():
            sys.exit(f"ERROR: env file not found: {env_file.relative_to(REPO_ROOT)}")

    api_vars = dotenv_values(API_ENV_FILE)
    web_vars = dotenv_values(WEB_ENV_FILE)

    supabase_url = (api_vars.get("SUPABASE_URL") or "").strip()
    supabase_secret_key = (api_vars.get("SUPABASE_SECRET_KEY") or "").strip()
    database_url = (api_vars.get("DATABASE_URL") or "").strip()
    publishable_key = (
        web_vars.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") or ""
    ).strip()

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
    base_url = supabase_url.rstrip("/")
    project_ref = _extract_project_ref(database_url, supabase_url)

    print(f"Project ref : {project_ref}")
    print(f"API URL     : {api_url}")
    print(f"PDF         : {pdf_path.name} ({pdf_path.stat().st_size} bytes)")

    if not args.yes:
        print("\nDry-run: specify --yes to execute the live extraction check.")
        print(
            "Ensure the FastAPI server is running:\n"
            "  cd apps/api && uvicorn app.main:app --reload --port 8000"
        )
        return 0

    # -----------------------------------------------------------------------
    # Reachability check
    # -----------------------------------------------------------------------
    print("\nChecking API reachability...")
    try:
        health_resp = httpx.get(f"{api_url}/health", timeout=5.0)
    except Exception as exc:
        print(f"FAIL: Cannot connect to API at {api_url}: {type(exc).__name__}")
        print("\nHINT: Start the development server first with:")
        print("      cd apps/api")
        print("      uvicorn app.main:app --reload --port 8000")
        return 1

    if health_resp.status_code != 200:
        print(f"FAIL: /health returned HTTP {health_resp.status_code}")
        return 1
    print("PASS: API reachable")

    # -----------------------------------------------------------------------
    # Admin headers
    # -----------------------------------------------------------------------
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

    # State for cleanup
    created_user_id: str | None = None
    submission_id: str | None = None
    author_id: str | None = None
    storage_path: str | None = None
    access_token: str | None = None
    t_start = time.time()

    try:
        # -------------------------------------------------------------------
        # 1. Create temporary confirmed author user
        # -------------------------------------------------------------------
        rand_tag = secrets.token_hex(4)
        email = f"extraction-check-{rand_tag}@example.com"
        password = _generate_strong_password()

        resp = httpx.post(
            f"{base_url}/auth/v1/admin/users",
            headers=admin_headers,
            json={"email": email, "password": password, "email_confirm": True},
            timeout=20.0,
        )
        if resp.status_code not in (200, 201):
            print(f"FAIL: Could not create test user: HTTP {resp.status_code}")
            return 1
        user_data = resp.json()
        created_user_id = user_data["id"]
        author_id = created_user_id
        print(f"Created test user: {created_user_id}")

        # -------------------------------------------------------------------
        # 2. Insert draft submission via database
        # -------------------------------------------------------------------
        with psycopg.connect(database_url) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO public.submissions
                        (author_id, status, manuscript_language, title, abstract, keywords)
                    VALUES (%s, 'draft', 'en', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb)
                    RETURNING id
                    """,
                    (author_id,),
                )
                row = cur.fetchone()
                submission_id = str(row[0])

                # Insert version row
                storage_path = f"{author_id}/{submission_id}/v1.pdf"
                cur.execute(
                    """
                    INSERT INTO public.submission_versions
                        (submission_id, round, manuscript_path)
                    VALUES (%s, 1, %s)
                    """,
                    (submission_id, storage_path),
                )
            conn.commit()
        print(f"Created submission: {submission_id}")

        # -------------------------------------------------------------------
        # 3. Upload PDF to Storage
        # -------------------------------------------------------------------
        pdf_bytes = pdf_path.read_bytes()
        upload_url = f"{base_url}/storage/v1/object/manuscripts/{storage_path}"
        upload_resp = httpx.post(
            upload_url,
            headers={
                "apikey": supabase_secret_key,
                "Authorization": f"Bearer {supabase_secret_key}",
                "Content-Type": "application/pdf",
            },
            content=pdf_bytes,
            timeout=60.0,
        )
        if upload_resp.status_code not in (200, 201):
            print(
                f"FAIL: Storage upload failed: HTTP {upload_resp.status_code}"
            )
            return 1
        print(f"Uploaded PDF: {len(pdf_bytes)} bytes -> {storage_path}")

        # -------------------------------------------------------------------
        # 4. Sign in as the test user
        # -------------------------------------------------------------------
        login_resp = httpx.post(
            f"{base_url}/auth/v1/token?grant_type=password",
            headers=client_headers,
            json={"email": email, "password": password},
            timeout=15.0,
        )
        if login_resp.status_code != 200:
            print(f"FAIL: Sign-in failed: HTTP {login_resp.status_code}")
            return 1
        access_token = login_resp.json().get("access_token")
        if not access_token:
            print("FAIL: No access token received")
            return 1
        print("Signed in successfully")

        auth_header = {"Authorization": f"Bearer {access_token}"}

        # -------------------------------------------------------------------
        # 5. Trigger extraction
        # -------------------------------------------------------------------
        extract_resp = httpx.post(
            f"{api_url}/submissions/{submission_id}/extract",
            headers=auth_header,
            timeout=15.0,
        )
        if extract_resp.status_code != 202:
            print(
                f"FAIL: POST /extract returned HTTP {extract_resp.status_code}: "
                f"{extract_resp.text[:200]}"
            )
            return 1
        print(f"Extraction triggered (202): {extract_resp.json()}")

        # -------------------------------------------------------------------
        # 6. Poll GET /extraction until done or timeout
        # -------------------------------------------------------------------
        print(f"Polling every {POLL_INTERVAL_S}s (timeout {POLL_TIMEOUT_S}s)...")
        final_data: dict | None = None
        deadline = time.time() + POLL_TIMEOUT_S
        while time.time() < deadline:
            time.sleep(POLL_INTERVAL_S)
            poll_resp = httpx.get(
                f"{api_url}/submissions/{submission_id}/extraction",
                headers=auth_header,
                timeout=15.0,
            )
            if poll_resp.status_code != 200:
                print(f"  Poll error: HTTP {poll_resp.status_code}")
                continue
            data = poll_resp.json()
            status = data.get("status")
            print(f"  status={status}")
            if status in ("succeeded", "failed"):
                final_data = data
                break

        elapsed = round(time.time() - t_start, 1)

        if final_data is None:
            print(f"\nFAIL: Extraction did not complete within {POLL_TIMEOUT_S}s")
            return 1

        # -------------------------------------------------------------------
        # 7. Print summary
        # -------------------------------------------------------------------
        print("\n" + "=" * 60)
        status = final_data.get("status")
        language = final_data.get("language")
        title = final_data.get("title") or {}
        abstract = final_data.get("abstract") or {}
        keywords = final_data.get("keywords") or {}
        authors = final_data.get("authors") or []
        error = final_data.get("error")

        print(f"Status    : {status}")
        print(f"Language  : {language}")
        print(f"Title     : {list(k for k, v in title.items() if v)}")
        print(f"Abstract  : {list(k for k, v in abstract.items() if v)}")
        print(f"Keywords  : {list(k for k, v in keywords.items() if v)}")
        print(f"Authors   : {len(authors)}")
        print(f"Elapsed   : {elapsed}s")
        if error:
            print(f"Error     : {error}")

        # Save full JSON result
        tmp_dir = Path(tempfile.gettempdir()) / "extraction-tests"
        tmp_dir.mkdir(parents=True, exist_ok=True)
        out_file = tmp_dir / f"{pdf_path.stem}-api.json"
        out_file.write_text(
            json.dumps(final_data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"\nFull result saved to: {out_file}")

        return 0 if status == "succeeded" else 1

    finally:
        # -------------------------------------------------------------------
        # Cleanup: always delete created resources in reverse order
        # -------------------------------------------------------------------
        print("\nCleaning up...")

        # Delete Storage object
        if storage_path:
            try:
                del_storage = httpx.delete(
                    f"{base_url}/storage/v1/object/manuscripts/{storage_path}",
                    headers={
                        "apikey": supabase_secret_key,
                        "Authorization": f"Bearer {supabase_secret_key}",
                    },
                    timeout=15.0,
                )
                if del_storage.status_code in (200, 204):
                    print(f"  [cleanup] Deleted storage object: {storage_path}")
                else:
                    print(
                        f"  [cleanup] WARNING: HTTP {del_storage.status_code} "
                        f"deleting storage object"
                    )
            except Exception as exc:
                print(f"  [cleanup] WARNING: Storage delete error: {type(exc).__name__}")

        # Delete version and submission via database (authors cascade from submission)
        if submission_id:
            try:
                with psycopg.connect(database_url) as conn:
                    with conn.cursor() as cur:
                        cur.execute(
                            "DELETE FROM public.submission_versions WHERE submission_id = %s",
                            (submission_id,),
                        )
                        cur.execute(
                            "DELETE FROM public.submissions WHERE id = %s",
                            (submission_id,),
                        )
                    conn.commit()
                print(f"  [cleanup] Deleted submission: {submission_id}")
            except Exception as exc:
                print(f"  [cleanup] WARNING: DB delete error: {type(exc).__name__}")

        # Delete temporary user
        if created_user_id:
            try:
                del_resp = httpx.delete(
                    f"{base_url}/auth/v1/admin/users/{created_user_id}",
                    headers=admin_headers,
                    timeout=15.0,
                )
                if del_resp.status_code in (200, 204):
                    print(f"  [cleanup] Deleted user: {created_user_id}")
                else:
                    print(
                        f"  [cleanup] WARNING: HTTP {del_resp.status_code} "
                        f"deleting user {created_user_id}"
                    )
            except Exception as exc:
                print(f"  [cleanup] WARNING: User delete error: {type(exc).__name__}")


if __name__ == "__main__":
    sys.exit(main())
