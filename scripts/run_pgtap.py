#!/usr/bin/env python3
"""
run_pgtap.py — Run pgTAP SQL test files against the Supabase database.

Usage
-----
  python scripts/run_pgtap.py          # dry-run: prints ref + files, then exits
  python scripts/run_pgtap.py --yes    # executes tests

Requirements
------------
  - pgtap extension enabled in the Supabase dashboard (Database → Extensions)
  - DATABASE_URL in apps/api/.env (format: postgresql://postgres.<ref>:<password>@…)
  - psycopg and python-dotenv installed (scripts/requirements.txt)

Exit codes
----------
  0  all tests passed
  1  one or more tests failed, a database error occurred, or no test files found
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Dependency imports — friendly error if the venv is not active
# ---------------------------------------------------------------------------
try:
    import psycopg  # type: ignore[import]
except ModuleNotFoundError:
    sys.exit(
        "ERROR: 'psycopg' not found. "
        "Run: pip install -r scripts/requirements.txt"
    )

try:
    from dotenv import dotenv_values  # type: ignore[import]
except ModuleNotFoundError:
    sys.exit(
        "ERROR: 'python-dotenv' not found. "
        "Run: pip install -r scripts/requirements.txt"
    )

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = REPO_ROOT / "apps" / "api" / ".env"
TESTS_DIR = REPO_ROOT / "supabase" / "tests" / "database"
_REF_RE = re.compile(r"postgres\.([a-z0-9]+)", re.IGNORECASE)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _load_database_url() -> str:
    """Load DATABASE_URL from apps/api/.env without leaking other values."""
    if not ENV_FILE.exists():
        sys.exit(f"ERROR: env file not found at {ENV_FILE.relative_to(REPO_ROOT)}")

    values = dotenv_values(ENV_FILE)
    url = values.get("DATABASE_URL", "").strip()
    if not url:
        sys.exit("ERROR: DATABASE_URL is not set in apps/api/.env")
    return url


def _extract_ref(url: str) -> str:
    """Return the Supabase project ref from the DATABASE_URL username field."""
    match = _REF_RE.search(url)
    if not match:
        sys.exit(
            "ERROR: cannot extract project ref from DATABASE_URL "
            "(expected username format: postgres.<ref>)"
        )
    return match.group(1)


def _find_test_files() -> list[Path]:
    """Return all *.sql and *.pg files sorted by name."""
    if not TESTS_DIR.exists():
        return []
    files = set(TESTS_DIR.glob("*.sql")) | set(TESTS_DIR.glob("*.pg"))
    return sorted(files, key=lambda p: p.name)


def _collect_tap_lines(cur: psycopg.Cursor) -> list[str]:
    """Drain all result sets from a pgTAP execution and return TAP lines."""
    tap: list[str] = []
    while True:
        try:
            rows = cur.fetchall()
        except psycopg.ProgrammingError:
            rows = []
        for row in rows:
            # pgTAP returns a single text column per row
            tap.append(str(row[0]))
        if not cur.nextset():
            break
    return tap


def _count_tap_results(lines: list[str]) -> tuple[int, int]:
    """Return (passed, failed) counts from TAP output lines."""
    passed = 0
    failed = 0
    has_plan = False
    for line in lines:
        if line.startswith("ok "):
            passed += 1
        elif line.startswith("not ok "):
            failed += 1
        elif re.match(r"^\d+\.\.\d+", line):
            has_plan = True
        elif "# Looks like you failed" in line:
            # TAP diagnostic — bumped into failures already counted above
            pass

    # If there was never a plan line the file probably errored before finish()
    if not has_plan:
        failed += 1

    return passed, failed


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> int:
    wants_run = "--yes" in sys.argv[1:]

    # Always load the URL and extract the ref (never print the URL itself)
    db_url = _load_database_url()
    ref = _extract_ref(db_url)

    test_files = _find_test_files()

    print(f"Project ref : {ref}")
    print(f"Tests dir   : {TESTS_DIR.relative_to(REPO_ROOT)}")

    if not test_files:
        print("\nNo *.sql or *.pg test files found — nothing to run.")
        return 1

    print(f"\nTest files ({len(test_files)}):")
    for tf in test_files:
        print(f"  {tf.relative_to(REPO_ROOT)}")

    if not wants_run:
        print(
            "\nDry-run mode. Pass --yes to execute the tests against "
            f"project '{ref}'."
        )
        return 0

    # -----------------------------------------------------------------------
    # Execute
    # -----------------------------------------------------------------------
    total_passed = 0
    total_failed = 0
    any_error = False

    for tf in test_files:
        rel = tf.relative_to(REPO_ROOT)
        print(f"\n{'─' * 60}")
        print(f"Running: {rel}")
        print("─" * 60)

        sql = tf.read_text(encoding="utf-8")

        try:
            # Each test file wraps itself in BEGIN / ROLLBACK so autocommit is
            # fine here — the transaction is entirely inside the SQL file.
            with psycopg.connect(db_url, autocommit=True) as conn:
                with conn.cursor() as cur:
                    cur.execute(sql)  # type: ignore[arg-type]
                    tap_lines = _collect_tap_lines(cur)

                # Defensive rollback — the file already ROLLBACKs, but we
                # ensure no open transaction remains on the connection.
                try:
                    with conn.cursor() as cur2:
                        cur2.execute("ROLLBACK")
                except Exception:
                    pass  # autocommit: ROLLBACK outside transaction is a no-op

        except psycopg.Error as exc:
            # Never embed the URL / connection string in the message.
            err_msg = str(exc).split("\n")[0]  # first line only, no detail
            # Strip any embedded passwords that psycopg might include
            err_msg = re.sub(r"password=[^\s]+", "password=***", err_msg)
            print(f"DATABASE ERROR in {rel}: {err_msg}")
            total_failed += 1
            any_error = True
            continue

        for line in tap_lines:
            print(line)

        passed, failed = _count_tap_results(tap_lines)
        total_passed += passed
        total_failed += failed

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    print(f"\n{'═' * 60}")
    print("SUMMARY")
    print(f"  Files   : {len(test_files)}")
    print(f"  Passed  : {total_passed}")
    print(f"  Failed  : {total_failed}")
    print("═" * 60)

    if total_failed > 0 or any_error:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
