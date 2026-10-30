"""
Unit tests for PostgREST to FastAPI error mapping table.
"""

from __future__ import annotations

import httpx
import pytest
from fastapi import HTTPException

from app.clients.errors import map_postgrest_error, raise_not_found_if_empty


def _make_response(
    status_code: int,
    json_body: dict | None = None,
    text: str = "",
) -> httpx.Response:
    request = httpx.Request("POST", "https://api.test/rest/v1/mock")
    if json_body is not None:
        return httpx.Response(status_code, json=json_body, request=request)
    return httpx.Response(status_code, text=text, request=request)


def test_error_mapping_42501_to_403():
    resp = _make_response(403, {"code": "42501", "message": "permission denied for table"})
    exc = map_postgrest_error(resp, resource_name="submissions")
    assert exc.status_code == 403
    assert "forbidden" in exc.detail


def test_error_mapping_23514_to_409():
    resp = _make_response(400, {"code": "23514", "message": "check constraint violation"})
    exc = map_postgrest_error(resp, resource_name="submissions")
    assert exc.status_code == 409
    assert "constraint" in exc.detail or "invalid" in exc.detail


def test_error_mapping_invalid_status_transition_to_409():
    resp = _make_response(
        400,
        {"code": "P0001", "message": "invalid status transition: draft → in_review"},
    )
    exc = map_postgrest_error(resp, resource_name="submissions")
    assert exc.status_code == 409
    assert "invalid status transition" in exc.detail


def test_error_mapping_23505_to_409():
    resp = _make_response(409, {"code": "23505", "message": "unique constraint violated"})
    exc = map_postgrest_error(resp, resource_name="submissions")
    assert exc.status_code == 409
    assert "already exists" in exc.detail


def test_error_mapping_23503_to_422():
    resp = _make_response(400, {"code": "23503", "message": "foreign key violation"})
    exc = map_postgrest_error(resp, resource_name="submission_authors")
    assert exc.status_code == 422
    assert "does not exist" in exc.detail


def test_error_mapping_22p02_and_23502_to_422():
    resp_22p02 = _make_response(
        400,
        {"code": "22P02", "message": "invalid input syntax for type uuid"},
    )
    exc_22 = map_postgrest_error(resp_22p02, resource_name="submissions")
    assert exc_22.status_code == 422

    resp_23502 = _make_response(
        400,
        {"code": "23502", "message": "null value in column violates not-null"},
    )
    exc_23 = map_postgrest_error(resp_23502, resource_name="submissions")
    assert exc_23.status_code == 422


def test_error_mapping_unhandled_to_502_without_upstream_leak():
    sensitive_internal_info = "SELECT * FROM secret_internal_table WHERE secret_col = 12345"
    resp = _make_response(500, {"code": "XX000", "message": sensitive_internal_info})
    exc = map_postgrest_error(resp, resource_name="submissions")
    assert exc.status_code == 502
    assert exc.detail == "bad gateway: upstream service error"
    assert sensitive_internal_info not in exc.detail


def test_raise_not_found_if_empty():
    # Non-empty does not raise
    raise_not_found_if_empty([{"id": "123"}], "Submission")

    # Empty raises 404
    with pytest.raises(HTTPException) as exc_info:
        raise_not_found_if_empty([], "Submission")
    assert exc_info.value.status_code == 404
    assert exc_info.value.detail == "Submission not found"
