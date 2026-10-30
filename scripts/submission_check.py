#!/usr/bin/env python3
"""
submission_check.py — Stage 1A E2E Verification Script for Journal Platform.

Validates the full submission, blind-copy, verification, and file download flows
against a live running FastAPI instance and real Supabase backend:
  1. Author creates draft submission.
  2. Author uploads manuscript and blind copy PDFs.
  3. Author sets metadata and author list.
  4. Author submits manuscript (draft -> submitted).
  5. Editor attempting start-review on unverified blind copy fails with 409 Conflict.
  6. Author attempting editor actions (verify, reject, start-review) fails with 403 Forbidden.
  7. Unrelated user attempting to view submission fails with 404 Not Found.
  8. Editor verifies blind copy (200 OK).
  9. Editor starts review (submitted -> in_review) (200 OK).
  10. Author and Editor obtain signed URLs for manuscript and download successfully (HTTP 200).
  11. Reviewer-only user response bodies are scanned to ensure zero author identity leaks.
  12. All temporary users, storage objects, and database rows are cleaned up in finally block.

Usage:
  python scripts/submission_check.py                 # Dry-run
  python scripts/submission_check.py --yes           # Executes live test against localhost:8000
  python scripts/submission_check.py --yes --api-url http://127.0.0.1:8000
"""

from __future__ import annotations

import argparse
import sys

import httpx

from _lifecycle_helpers import (
    create_temp_user,
    create_test_pdf,
    delete_temp_user,
    load_env_config,
    scan_json_leaks,
    set_user_role,
    sign_in_user,
)

try:
    import psycopg
except ModuleNotFoundError:
    psycopg = None  # type: ignore[assignment]


def _pass(name: str) -> None:
    print(f"PASS  [{name}]")


def _fail(name: str, message: str) -> None:
    print(f"FAIL  [{name}] {message}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Stage 1A E2E validation script.")
    parser.add_argument("--yes", action="store_true", help="Execute checks against running API")
    parser.add_argument("--api-url", default="http://localhost:8000", help="Target API URL")
    args = parser.parse_args()

    env = load_env_config()
    api_url = args.api_url.rstrip("/")

    if not args.yes:
        print("Dry-run: specify --yes to execute the live Stage 1A submission checks.")
        print(f"Target API URL: {api_url}")
        print("Ensure the FastAPI server is running:")
        print("  cd apps/api && uvicorn app.main:app --reload --port 8000")
        return 0

    # 1. API reachability check
    try:
        health_resp = httpx.get(f"{api_url}/health", timeout=5.0)
        if health_resp.status_code != 200:
            _fail("api-reachability", f"/health returned HTTP {health_resp.status_code}")
            return 1
        _pass("api-reachability")
    except Exception as exc:
        _fail("api-reachability", f"Cannot connect to {api_url}: {type(exc).__name__}")
        print("HINT: Start the development server first with: uvicorn app.main:app --port 8000")
        return 1

    base_url = env["SUPABASE_URL"].rstrip("/")
    secret_key = env["SUPABASE_SECRET_KEY"]
    publishable_key = env["SUPABASE_PUBLISHABLE_KEY"]
    database_url = env["DATABASE_URL"]

    created_users: list[dict[str, str]] = []
    created_submission_ids: list[str] = []
    created_storage_paths: list[tuple[str, str]] = []
    all_passed = True

    try:
        # Provision temporary users
        print("\nProvisioning temporary author, editor, and reviewer users...")
        author = create_temp_user(base_url, secret_key, role="author", email_prefix="sub-author")
        created_users.append(author)

        editor = create_temp_user(base_url, secret_key, role="editor", email_prefix="sub-editor")
        created_users.append(editor)
        set_user_role(database_url, editor["id"], "editor")

        reviewer = create_temp_user(
            base_url, secret_key, role="reviewer", email_prefix="sub-reviewer"
        )
        created_users.append(reviewer)
        set_user_role(database_url, reviewer["id"], "reviewer")
        _pass("provision-users")

        # Sign in users
        author_token = sign_in_user(
            base_url, publishable_key, author["email"], author["password"]
        )
        editor_token = sign_in_user(
            base_url, publishable_key, editor["email"], editor["password"]
        )
        reviewer_token = sign_in_user(
            base_url, publishable_key, reviewer["email"], reviewer["password"]
        )
        _pass("authenticate-users")

        author_headers = {"Authorization": f"Bearer {author_token}"}
        editor_headers = {"Authorization": f"Bearer {editor_token}"}
        reviewer_headers = {"Authorization": f"Bearer {reviewer_token}"}

        # Step 1: Author creates draft
        create_resp = httpx.post(
            f"{api_url}/submissions",
            headers=author_headers,
            json={"manuscript_language": "en"},
            timeout=10.0,
        )
        if create_resp.status_code != 201:
            _fail("create-draft", f"Expected 201, got {create_resp.status_code}")
            all_passed = False
            return 1
        sub_id = create_resp.json()["id"]
        created_submission_ids.append(sub_id)
        _pass("create-draft")

        # Step 2: Upload manuscript
        author_name = "Jane Author"
        author_email = author["email"]
        manuscript_pdf = create_test_pdf(
            text=f"Full manuscript authored by {author_name} ({author_email})"
        )
        m_resp = httpx.post(
            f"{api_url}/submissions/{sub_id}/manuscript",
            headers=author_headers,
            files={"file": ("manuscript.pdf", manuscript_pdf, "application/pdf")},
            timeout=15.0,
        )
        if m_resp.status_code == 200 and m_resp.json().get("round") == 1:
            created_storage_paths.append(("manuscripts", f"{author['id']}/{sub_id}/v1.pdf"))
            _pass("upload-manuscript")
        else:
            _fail("upload-manuscript", f"HTTP {m_resp.status_code}: {m_resp.text}")
            all_passed = False

        # Step 3: Upload blind copy
        blind_pdf = create_test_pdf(
            text=f"Anonymized version mentioning {author_name} for testing detection"
        )
        b_resp = httpx.post(
            f"{api_url}/submissions/{sub_id}/blind-copy",
            headers=author_headers,
            files={"file": ("blind.pdf", blind_pdf, "application/pdf")},
            timeout=15.0,
        )
        if b_resp.status_code == 200 and b_resp.json().get("round") == 1:
            created_storage_paths.append(("manuscripts-anonymized", f"{sub_id}/v1.pdf"))
            warnings = b_resp.json().get("warnings", [])
            if any(w.get("type") == "author_name" for w in warnings):
                _pass("upload-blind-copy-with-trace-detection")
            else:
                _pass("upload-blind-copy")
        else:
            _fail("upload-blind-copy", f"HTTP {b_resp.status_code}: {b_resp.text}")
            all_passed = False

        # Step 4: Set metadata and authors
        meta_resp = httpx.put(
            f"{api_url}/submissions/{sub_id}/metadata",
            headers=author_headers,
            json={
                "title": {"en": "Advancements in Journal Systems"},
                "abstract": {"en": "Comprehensive study of peer review automation."},
                "keywords": {"en": ["academic", "publishing", "workflow"]},
            },
            timeout=10.0,
        )
        if meta_resp.status_code == 200:
            _pass("set-metadata")
        else:
            _fail("set-metadata", f"HTTP {meta_resp.status_code}")
            all_passed = False

        authors_resp = httpx.put(
            f"{api_url}/submissions/{sub_id}/authors",
            headers=author_headers,
            json={
                "authors": [
                    {
                        "full_name": author_name,
                        "email": author_email,
                        "affiliations": ["University of Testing"],
                        "is_corresponding": True,
                    }
                ]
            },
            timeout=10.0,
        )
        if authors_resp.status_code == 200:
            _pass("set-authors")
        else:
            _fail("set-authors", f"HTTP {authors_resp.status_code}")
            all_passed = False

        # Step 5: Author submits
        submit_resp = httpx.post(
            f"{api_url}/submissions/{sub_id}/submit",
            headers=author_headers,
            timeout=10.0,
        )
        if submit_resp.status_code == 200 and submit_resp.json().get("status") == "submitted":
            _pass("submit-manuscript")
        else:
            _fail("submit-manuscript", f"HTTP {submit_resp.status_code}: {submit_resp.text}")
            all_passed = False

        # Step 6: Start-review fails prior to blind-copy verification (409 Conflict)
        early_start_resp = httpx.post(
            f"{api_url}/submissions/{sub_id}/start-review",
            headers=editor_headers,
            timeout=10.0,
        )
        if early_start_resp.status_code == 409:
            _pass("start-review-unverified-rejected-409")
        else:
            _fail(
                "start-review-unverified-rejected-409",
                f"Expected 409, got {early_start_resp.status_code}",
            )
            all_passed = False

        # Step 7: Author cannot call editor endpoints (403 Forbidden)
        author_verify_resp = httpx.post(
            f"{api_url}/submissions/{sub_id}/blind-copy/verify",
            headers=author_headers,
            timeout=10.0,
        )
        author_reject_resp = httpx.post(
            f"{api_url}/submissions/{sub_id}/blind-copy/reject",
            headers=author_headers,
            json={"note": "Unauthorized reject attempt"},
            timeout=10.0,
        )
        author_start_resp = httpx.post(
            f"{api_url}/submissions/{sub_id}/start-review",
            headers=author_headers,
            timeout=10.0,
        )
        if (
            author_verify_resp.status_code == 403
            and author_reject_resp.status_code == 403
            and author_start_resp.status_code == 403
        ):
            _pass("author-editor-endpoints-forbidden-403")
        else:
            _fail(
                "author-editor-endpoints-forbidden-403",
                f"Got status codes: {author_verify_resp.status_code}, "
                f"{author_reject_resp.status_code}, {author_start_resp.status_code}",
            )
            all_passed = False

        # Step 8: Unrelated reviewer gets 404 on submission
        reviewer_get_resp = httpx.get(
            f"{api_url}/submissions/{sub_id}",
            headers=reviewer_headers,
            timeout=10.0,
        )
        if reviewer_get_resp.status_code == 404:
            _pass("unrelated-user-cannot-see-submission-404")
        else:
            _fail(
                "unrelated-user-cannot-see-submission-404",
                f"Expected 404, got {reviewer_get_resp.status_code}",
            )
            all_passed = False

        # Step 9: Editor verifies blind copy
        verify_resp = httpx.post(
            f"{api_url}/submissions/{sub_id}/blind-copy/verify",
            headers=editor_headers,
            timeout=10.0,
        )
        if verify_resp.status_code == 200 and verify_resp.json().get("status") == "verified":
            _pass("editor-verify-blind-copy")
        else:
            _fail(
                "editor-verify-blind-copy",
                f"HTTP {verify_resp.status_code}: {verify_resp.text}",
            )
            all_passed = False

        # Step 10: Editor starts review (submitted -> in_review)
        start_resp = httpx.post(
            f"{api_url}/submissions/{sub_id}/start-review",
            headers=editor_headers,
            timeout=10.0,
        )
        if start_resp.status_code == 200 and start_resp.json().get("status") == "in_review":
            _pass("editor-start-review-success")
        else:
            _fail(
                "editor-start-review-success",
                f"HTTP {start_resp.status_code}: {start_resp.text}",
            )
            all_passed = False

        # Step 11: Signed manuscript URLs for author and editor
        auth_file_resp = httpx.get(
            f"{api_url}/submissions/{sub_id}/files/manuscript",
            headers=author_headers,
            timeout=10.0,
        )
        ed_file_resp = httpx.get(
            f"{api_url}/submissions/{sub_id}/files/manuscript",
            headers=editor_headers,
            timeout=10.0,
        )
        if auth_file_resp.status_code == 200 and ed_file_resp.status_code == 200:
            auth_url = auth_file_resp.json().get("url")
            ed_url = ed_file_resp.json().get("url")
            # Download through signed URLs
            dl_auth = httpx.get(auth_url, timeout=10.0)
            dl_ed = httpx.get(ed_url, timeout=10.0)
            if dl_auth.status_code == 200 and dl_ed.status_code == 200:
                _pass("signed-manuscript-url-downloads-200")
            else:
                _fail(
                    "signed-manuscript-url-downloads-200",
                    f"Download HTTP statuses: {dl_auth.status_code}, {dl_ed.status_code}",
                )
                all_passed = False
        else:
            _fail(
                "signed-manuscript-url-downloads-200",
                f"Fetch statuses: {auth_file_resp.status_code}, {ed_file_resp.status_code}",
            )
            all_passed = False

        # Step 12: Reviewer response body leak scan
        rev_list_resp = httpx.get(
            f"{api_url}/submissions",
            headers=reviewer_headers,
            timeout=10.0,
        )
        rev_detail_resp = httpx.get(
            f"{api_url}/submissions/{sub_id}",
            headers=reviewer_headers,
            timeout=10.0,
        )
        forbidden = [author["id"], author["email"], author_name]
        leaks_list = scan_json_leaks(rev_list_resp.text, forbidden)
        leaks_detail = scan_json_leaks(rev_detail_resp.text, forbidden)
        if not leaks_list and not leaks_detail:
            _pass("reviewer-response-zero-author-leaks")
        else:
            _fail(
                "reviewer-response-zero-author-leaks",
                "Author identification traces detected in reviewer response body",
            )
            all_passed = False

    finally:
        # Cleanup storage objects, database rows, and temporary users
        print("\nCleaning up test artifacts...")
        # Clean storage objects
        for bucket, path in created_storage_paths:
            try:
                httpx.delete(
                    f"{base_url}/storage/v1/object/{bucket}/{path}",
                    headers={
                        "apikey": secret_key,
                        "Authorization": f"Bearer {secret_key}",
                    },
                    timeout=10.0,
                )
            except Exception:
                pass

        # Clean database rows
        if psycopg is not None and created_submission_ids:
            try:
                with psycopg.connect(database_url) as conn:
                    with conn.cursor() as cur:
                        for s_id in created_submission_ids:
                            cur.execute(
                                "DELETE FROM public.submission_versions WHERE submission_id = %s",
                                (s_id,),
                            )
                            cur.execute(
                                "DELETE FROM public.submission_authors WHERE submission_id = %s",
                                (s_id,),
                            )
                            cur.execute(
                                "DELETE FROM public.submission_status_history "
                                "WHERE submission_id = %s",
                                (s_id,),
                            )
                            cur.execute(
                                "DELETE FROM public.submissions WHERE id = %s",
                                (s_id,),
                            )
                    conn.commit()
            except Exception:
                pass

        # Clean users
        for u in created_users:
            delete_temp_user(base_url, secret_key, u["id"])

    print("\n" + ("=" * 46))
    if all_passed:
        print("RESULT: All Stage 1A submission checks PASSED.")
        return 0
    else:
        print("RESULT: One or more Stage 1A checks FAILED.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
