"""
Pydantic v2 schemas for LLM metadata extraction results.

All normalization is applied in validators so that downstream code can rely on
consistent, clean values without extra processing.
"""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

Locale = Literal["en", "fr", "ar"]
_VALID_LOCALES: frozenset[str] = frozenset({"en", "fr", "ar"})

# Regex patterns
_ORCID_RE = re.compile(r"^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$")
# Permissive email: local@domain.tld — rejects most obviously wrong values
_EMAIL_RE = re.compile(r"^[^@\s]{1,64}@[^@\s]{1,253}\.[^@\s.]{2,63}$")
_TRAILING_PUNCT_RE = re.compile(r"[.;,]+$")


def _strip_whitespace(s: str) -> str:
    """Strip leading/trailing whitespace."""
    return s.strip()


def _collapse_internal_whitespace(s: str) -> str:
    """Collapse multiple spaces/tabs on each line; preserve line breaks."""
    lines = s.split("\n")
    collapsed = [re.sub(r"[ \t]+", " ", line).strip() for line in lines]
    return "\n".join(collapsed)


def _normalize_keyword(kw: str) -> str:
    """Strip whitespace, collapse internal spaces, remove trailing punctuation."""
    kw = _strip_whitespace(kw)
    kw = re.sub(r"[ \t]+", " ", kw)
    kw = _TRAILING_PUNCT_RE.sub("", kw).strip()
    return kw


def _dedupe_keywords(keywords: list[str]) -> list[str]:
    """Deduplicate keywords case-insensitively, keeping first occurrence."""
    seen: set[str] = set()
    result: list[str] = []
    for kw in keywords:
        lower = kw.lower()
        if lower not in seen:
            seen.add(lower)
            result.append(kw)
    return result


def _clean_locale_dict_str(
    data: dict,
    max_chars: int,
    collapse_internal: bool = True,
) -> dict[Locale, str | None]:
    """
    Normalize a locale-keyed dict of strings:
    - Drop keys not in en/fr/ar
    - Strip whitespace
    - Optionally collapse internal whitespace
    - Truncate at max_chars
    - Drop empty strings (set to None)
    - Fill missing locale keys with None
    """
    result: dict[str, str | None] = {}
    for locale in _VALID_LOCALES:
        val = data.get(locale)
        if val is None or val == "":
            result[locale] = None
        elif isinstance(val, str):
            v = _strip_whitespace(val)
            if collapse_internal:
                v = _collapse_internal_whitespace(v)
            v = v[:max_chars]
            result[locale] = v if v else None
        else:
            result[locale] = None
    return result  # type: ignore[return-value]


def _clean_locale_dict_list(data: dict) -> dict[Locale, list[str]]:
    """
    Normalize a locale-keyed dict of keyword lists:
    - Drop keys outside en/fr/ar
    - Normalize each keyword
    - Drop empties
    - Deduplicate case-insensitively
    - Cap at 15 per language
    - Cap each keyword at 120 chars
    - Fill missing locales with []
    """
    result: dict[str, list[str]] = {}
    for locale in _VALID_LOCALES:
        raw = data.get(locale, [])
        if not isinstance(raw, list):
            result[locale] = []
            continue
        cleaned: list[str] = []
        for kw in raw:
            if not isinstance(kw, str):
                continue
            kw = _normalize_keyword(kw)
            if kw:
                cleaned.append(kw[:120])
        deduped = _dedupe_keywords(cleaned)
        result[locale] = deduped[:15]
    return result  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Sub-models
# ---------------------------------------------------------------------------


class ExtractedAuthor(BaseModel):
    """A single author entry from the extracted metadata."""

    model_config = {"extra": "ignore"}

    full_name: str = Field(..., description="Author's full name as printed")
    affiliations: list[str] = Field(default_factory=list)
    email: str | None = None
    orcid: str | None = None
    is_corresponding: bool = False

    @field_validator("full_name", mode="before")
    @classmethod
    def validate_full_name(cls, v: object) -> str:
        if not isinstance(v, str):
            raise ValueError("full_name must be a string")
        v = _strip_whitespace(v)
        if not v:
            raise ValueError("full_name must not be empty")
        return v

    @field_validator("affiliations", mode="before")
    @classmethod
    def validate_affiliations(cls, v: object) -> list[str]:
        if not isinstance(v, list):
            return []
        result = []
        for item in v:
            if isinstance(item, str):
                cleaned = _strip_whitespace(item)
                if cleaned:
                    result.append(cleaned)
        return result

    @field_validator("email", mode="before")
    @classmethod
    def validate_email(cls, v: object) -> str | None:
        if v is None or v == "":
            return None
        if not isinstance(v, str):
            return None
        v = _strip_whitespace(v)
        if not v:
            return None
        return v if _EMAIL_RE.match(v) else None

    @field_validator("orcid", mode="before")
    @classmethod
    def validate_orcid(cls, v: object) -> str | None:
        if v is None or v == "":
            return None
        if not isinstance(v, str):
            return None
        v = _strip_whitespace(v)
        if not v:
            return None
        return v if _ORCID_RE.match(v) else None


# ---------------------------------------------------------------------------
# Main extraction result schema
# ---------------------------------------------------------------------------


class ExtractionResult(BaseModel):
    """
    Validated and normalized output of LLM metadata extraction.

    All three locale keys are always present in title, abstract, and keywords
    after validation (missing ones are filled with None / []).
    """

    model_config = {"extra": "ignore"}

    language: Locale
    title: dict[Locale, str | None]
    abstract: dict[Locale, str | None]
    keywords: dict[Locale, list[str]]
    authors: list[ExtractedAuthor] = Field(default_factory=list)
    notes: str | None = None

    @field_validator("language", mode="before")
    @classmethod
    def validate_language(cls, v: object) -> str:
        if v not in _VALID_LOCALES:
            raise ValueError(f"language must be one of en/fr/ar, got {v!r}")
        return v  # type: ignore[return-value]

    @field_validator("title", mode="before")
    @classmethod
    def validate_title(cls, v: object) -> dict:
        if not isinstance(v, dict):
            return {"en": None, "fr": None, "ar": None}
        return _clean_locale_dict_str(v, max_chars=500, collapse_internal=True)

    @field_validator("abstract", mode="before")
    @classmethod
    def validate_abstract(cls, v: object) -> dict:
        if not isinstance(v, dict):
            return {"en": None, "fr": None, "ar": None}
        # Keep paragraph breaks (\n), but collapse horizontal whitespace
        return _clean_locale_dict_str(v, max_chars=8000, collapse_internal=True)

    @field_validator("keywords", mode="before")
    @classmethod
    def validate_keywords(cls, v: object) -> dict:
        if not isinstance(v, dict):
            return {"en": [], "fr": [], "ar": []}
        return _clean_locale_dict_list(v)

    @field_validator("authors", mode="before")
    @classmethod
    def validate_authors(cls, v: object) -> list:
        if not isinstance(v, list):
            return []
        return v[:50]

    @field_validator("notes", mode="before")
    @classmethod
    def validate_notes(cls, v: object) -> str | None:
        if v is None or v == "":
            return None
        if not isinstance(v, str):
            return None
        v = _strip_whitespace(v)
        return v[:500] if v else None

    @model_validator(mode="after")
    def require_some_title(self) -> ExtractionResult:
        """Reject if not a single locale has a title."""
        has_title = any(v for v in self.title.values() if v)
        if not has_title:
            raise ValueError("ExtractionResult must have at least one non-empty title locale")
        return self
