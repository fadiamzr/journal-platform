"""
Tests for role-based access control, role hierarchy semantics, and 403 error responses.
"""

from __future__ import annotations

import pytest


@pytest.mark.asyncio
async def test_author_on_editor_and_admin_routes_forbidden(client, token_builder):
    """Author token accessing editor or admin routes is denied with 403."""
    token = token_builder(user_role="author")
    headers = {"Authorization": f"Bearer {token}"}

    resp_editor = await client.get("/debug/editor", headers=headers)
    assert resp_editor.status_code == 403
    err = resp_editor.json()["error"]
    assert err["code"] == "forbidden"
    assert "insufficient permissions" in err["message"]
    assert "request_id" in err

    resp_admin = await client.get("/debug/admin", headers=headers)
    assert resp_admin.status_code == 403


@pytest.mark.asyncio
async def test_editor_on_debug_editor_allowed(client, token_builder):
    """Editor token accessing /debug/editor succeeds with 200."""
    token = token_builder(user_role="editor")
    resp = await client.get("/debug/editor", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "role": "editor"}


@pytest.mark.asyncio
async def test_admin_on_debug_editor_allowed(client, token_builder):
    """Admin is permitted on editor routes by role hierarchy semantics."""
    token = token_builder(user_role="admin")
    resp = await client.get("/debug/editor", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "role": "editor"}


@pytest.mark.asyncio
async def test_reviewer_on_debug_editor_forbidden(client, token_builder):
    """Reviewer token accessing editor routes is denied with 403."""
    token = token_builder(user_role="reviewer")
    resp = await client.get("/debug/editor", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403
    assert resp.json()["error"]["code"] == "forbidden"


@pytest.mark.asyncio
async def test_null_user_role_allowed_on_me_but_forbidden_on_role_routes(client, token_builder):
    """Token with null user_role can access /me but is denied (403) on any role-guarded route."""
    token = token_builder(user_role=None)
    headers = {"Authorization": f"Bearer {token}"}

    # /me succeeds with user_role null
    resp_me = await client.get("/me", headers=headers)
    assert resp_me.status_code == 200
    assert resp_me.json()["user_role"] is None

    # Role routes fail with 403
    assert (await client.get("/debug/author", headers=headers)).status_code == 403
    assert (await client.get("/debug/reviewer", headers=headers)).status_code == 403
    assert (await client.get("/debug/editor", headers=headers)).status_code == 403
    assert (await client.get("/debug/admin", headers=headers)).status_code == 403


@pytest.mark.asyncio
async def test_author_and_reviewer_and_admin_exact_matches(client, token_builder):
    """Verify exact role matches for author, reviewer, and admin routes."""
    # Author on author route
    t_author = token_builder(user_role="author")
    resp = await client.get("/debug/author", headers={"Authorization": f"Bearer {t_author}"})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "role": "author"}

    # Reviewer on reviewer route
    t_rev = token_builder(user_role="reviewer")
    resp = await client.get("/debug/reviewer", headers={"Authorization": f"Bearer {t_rev}"})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "role": "reviewer"}

    # Admin on admin route
    t_admin = token_builder(user_role="admin")
    resp = await client.get("/debug/admin", headers={"Authorization": f"Bearer {t_admin}"})
    assert resp.status_code == 200
    assert resp.json() == {"ok": True, "role": "admin"}

    # Editor on admin route is denied (admin route is strictly admin)
    t_editor = token_builder(user_role="editor")
    resp = await client.get("/debug/admin", headers={"Authorization": f"Bearer {t_editor}"})
    assert resp.status_code == 403
