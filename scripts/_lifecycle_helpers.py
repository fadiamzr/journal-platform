"""
_lifecycle_helpers.py — Shared lifecycle and test utilities for check scripts.

Provides:
  - Environment variable loader for API and web apps
  - Temporary confirmed user provisioning and deletion via Supabase Auth admin API
  - Direct database role assignment via psycopg
  - User sign-in (access token retrieval)
  - In-memory PDF generation using pypdf
  - JSON response leak scanner (scans for forbidden author identifiers)

Security:
  - NEVER logs or prints raw tokens, keys, passwords, or file contents.
"""

from __future__ import annotations

import io
import json
import secrets
import string
import sys
from pathlib import Path
from typing import Any

import httpx
from pypdf import PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject

try:
    import psycopg
except ModuleNotFoundError:
    psycopg = None  # type: ignore[assignment]

try:
    from dotenv import dotenv_values
except ModuleNotFoundError:
    dotenv_values = None  # type: ignore[assignment]

REPO_ROOT = Path(__file__).resolve().parent.parent
API_ENV_FILE = REPO_ROOT / "apps" / "api" / ".env"
WEB_ENV_FILE = REPO_ROOT / "apps" / "web" / ".env.local"


def load_env_config() -> dict[str, str]:
    """
    Load environment variables from apps/api/.env and apps/web/.env.local.
    Returns a dict with:
      - SUPABASE_URL
      - SUPABASE_SECRET_KEY
      - DATABASE_URL
      - SUPABASE_PUBLISHABLE_KEY
    """
    if dotenv_values is None:
        sys.exit("ERROR: 'python-dotenv' not found. Run: pip install -r scripts/requirements.txt")

    if not API_ENV_FILE.exists():
        sys.exit(f"ERROR: API env file not found at {API_ENV_FILE.relative_to(REPO_ROOT)}")

    api_vars = dotenv_values(API_ENV_FILE)
    web_vars = dotenv_values(WEB_ENV_FILE) if WEB_ENV_FILE.exists() else {}

    supabase_url = (api_vars.get("SUPABASE_URL") or "").strip()
    supabase_secret_key = (api_vars.get("SUPABASE_SECRET_KEY") or "").strip()
    database_url = (api_vars.get("DATABASE_URL") or "").strip()

    # Publishable key may be in web env or api env
    publishable_key = (
        api_vars.get("SUPABASE_PUBLISHABLE_KEY")
        or web_vars.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
        or ""
    ).strip()

    missing: list[str] = []
    if not supabase_url:
        missing.append("SUPABASE_URL")
    if not supabase_secret_key:
        missing.append("SUPABASE_SECRET_KEY")
    if not database_url:
        missing.append("DATABASE_URL")
    if not publishable_key:
        missing.append("SUPABASE_PUBLISHABLE_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")

    if missing:
        sys.exit("ERROR: Missing required configuration keys:\n  - " + "\n  - ".join(missing))

    return {
        "SUPABASE_URL": supabase_url,
        "SUPABASE_SECRET_KEY": supabase_secret_key,
        "DATABASE_URL": database_url,
        "SUPABASE_PUBLISHABLE_KEY": publishable_key,
    }


def generate_secure_password() -> str:
    """Generate high-entropy password satisfying Supabase password complexity rules."""
    prefix = (
        secrets.choice(string.ascii_uppercase)
        + secrets.choice(string.ascii_lowercase)
        + secrets.choice(string.digits)
        + secrets.choice("!@#$%&*")
    )
    charset = string.ascii_letters + string.digits + "!@#$%&*-_"
    suffix = "".join(secrets.choice(charset) for _ in range(16))
    return prefix + suffix


def create_temp_user(
    base_url: str,
    secret_key: str,
    role: str = "author",
    email_prefix: str = "subcheck",
) -> dict[str, str]:
    """
    Create a confirmed user via the Auth admin API.
    Returns: {"id": user_id, "email": email, "password": password, "role": role}
    """
    clean_base = base_url.rstrip("/")
    tag = secrets.token_hex(4)
    email = f"{email_prefix}-{role}-{tag}@example.com"
    password = generate_secure_password()

    headers = {
        "apikey": secret_key,
        "Authorization": f"Bearer {secret_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "email": email,
        "password": password,
        "email_confirm": True,
    }

    resp = httpx.post(
        f"{clean_base}/auth/v1/admin/users",
        headers=headers,
        json=payload,
        timeout=20.0,
    )
    if resp.status_code not in (200, 201):
        raise RuntimeError(
            f"Failed to create temporary user ({role}): HTTP {resp.status_code} - {resp.text}"
        )

    user_id = resp.json()["id"]
    return {
        "id": user_id,
        "email": email,
        "password": password,
        "role": role,
    }


def set_user_role(database_url: str, user_id: str, role: str) -> None:
    """Assign role directly in public.user_profiles using psycopg."""
    if psycopg is None:
        raise RuntimeError("psycopg is required to update user roles directly in database.")

    with psycopg.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE public.user_profiles SET role = %s WHERE id = %s",
                (role, user_id),
            )
            cur.execute("SELECT role FROM public.user_profiles WHERE id = %s", (user_id,))
            row = cur.fetchone()
            if not row or str(row[0]) != role:
                raise RuntimeError(f"Role verification failed for user {user_id}: expected {role}")
        conn.commit()


def sign_in_user(base_url: str, publishable_key: str, email: str, password: str) -> str:
    """Sign in user and return access token without printing or logging it."""
    clean_base = base_url.rstrip("/")
    headers = {
        "apikey": publishable_key,
        "Authorization": f"Bearer {publishable_key}",
        "Content-Type": "application/json",
    }
    resp = httpx.post(
        f"{clean_base}/auth/v1/token?grant_type=password",
        headers=headers,
        json={"email": email, "password": password},
        timeout=15.0,
    )
    if resp.status_code != 200:
        raise RuntimeError(f"Sign-in failed for {email}: HTTP {resp.status_code}")

    token = resp.json().get("access_token")
    if not token:
        raise RuntimeError("Missing access_token in sign-in response")
    return token


def delete_temp_user(base_url: str, secret_key: str, user_id: str) -> bool:
    """Delete a temporary user via the Auth admin API."""
    clean_base = base_url.rstrip("/")
    headers = {
        "apikey": secret_key,
        "Authorization": f"Bearer {secret_key}",
    }
    try:
        resp = httpx.delete(
            f"{clean_base}/auth/v1/admin/users/{user_id}",
            headers=headers,
            timeout=15.0,
        )
        return resp.status_code in (200, 204)
    except Exception:
        return False


def create_test_pdf(text: str = "Academic Paper Test", num_pages: int = 1) -> bytes:
    """Generate in-memory valid PDF bytes without saving to disk."""
    writer = PdfWriter()
    for _ in range(num_pages):
        page = writer.add_blank_page(width=200, height=200)
        font_dict = DictionaryObject({
            NameObject("/Type"): NameObject("/Font"),
            NameObject("/Subtype"): NameObject("/Type1"),
            NameObject("/BaseFont"): NameObject("/Helvetica"),
        })
        page[NameObject("/Resources")] = DictionaryObject({
            NameObject("/Font"): DictionaryObject({NameObject("/F1"): font_dict})
        })
        content = f"BT /F1 12 Tf 20 100 Td ({text}) Tj ET".encode("latin-1", errors="ignore")
        stream = DecodedStreamObject()
        stream.set_data(content)
        page[NameObject("/Contents")] = stream

    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def scan_json_leaks(body: Any, forbidden_strings: list[str]) -> list[str]:
    """
    Recursively scans JSON-compatible data (dict, list, str) or serialized text
    for forbidden strings (case-insensitive).
    Returns a list of forbidden identifiers found (does not leak raw values).
    """
    if not forbidden_strings:
        return []

    serialized: str
    if isinstance(body, (dict, list)):
        serialized = json.dumps(body)
    elif isinstance(body, str):
        serialized = body
    else:
        serialized = str(body)

    lower_serialized = serialized.lower()
    leaks: list[str] = []
    for item in forbidden_strings:
        clean_item = item.strip().lower()
        if len(clean_item) >= 3 and clean_item in lower_serialized:
            leaks.append(f"matched_length_{len(clean_item)}")

    return leaks
