"""
Metadata normalization helpers for multilingual JSONB fields (title, abstract, keywords).
Supported language locales: 'en', 'fr', 'ar'.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException, status

ALLOWED_LOCALES = {"en", "fr", "ar"}


def normalize_title(title: Any) -> dict[str, str]:
    """Validate and normalize multilingual title dictionary."""
    if not isinstance(title, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Title must be an object with language keys (en, fr, ar)",
        )

    normalized: dict[str, str] = {}
    locales_str = ", ".join(sorted(ALLOWED_LOCALES))
    for lang, val in title.items():
        if lang not in ALLOWED_LOCALES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Invalid language code '{lang}' in title; must be one of {locales_str}",
            )
        if isinstance(val, str) and val.strip():
            normalized[lang] = val.strip()

    return normalized


def normalize_abstract(abstract: Any) -> dict[str, str]:
    """Validate and normalize multilingual abstract dictionary."""
    if not isinstance(abstract, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Abstract must be an object with language keys (en, fr, ar)",
        )

    normalized: dict[str, str] = {}
    locales_str = ", ".join(sorted(ALLOWED_LOCALES))
    for lang, val in abstract.items():
        if lang not in ALLOWED_LOCALES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Invalid language code '{lang}' in abstract; must be one of {locales_str}",
            )
        if isinstance(val, str) and val.strip():
            normalized[lang] = val.strip()

    return normalized


def normalize_keywords(keywords: Any) -> dict[str, list[str]]:
    """Validate and normalize multilingual keywords dictionary."""
    if not isinstance(keywords, dict):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Keywords must be an object mapping language keys to string arrays",
        )

    normalized: dict[str, list[str]] = {}
    locales_str = ", ".join(sorted(ALLOWED_LOCALES))
    for lang, val in keywords.items():
        if lang not in ALLOWED_LOCALES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Invalid language code '{lang}' in keywords; must be one of {locales_str}",
            )
        if not isinstance(val, (list, tuple)):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail=f"Keywords for '{lang}' must be a list of strings",
            )
        cleaned = [item.strip() for item in val if isinstance(item, str) and item.strip()]
        if cleaned:
            normalized[lang] = cleaned

    return normalized
