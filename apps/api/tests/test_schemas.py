"""
Tests for app.llm.schemas — normalization, validation, and rejection rules.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.llm.schemas import ExtractedAuthor, ExtractionResult

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _minimal_result(**overrides) -> dict:
    base = {
        "language": "en",
        "title": {"en": "Test Title", "fr": None, "ar": None},
        "abstract": {"en": "Abstract text.", "fr": None, "ar": None},
        "keywords": {"en": ["keyword"], "fr": [], "ar": []},
        "authors": [{"full_name": "Jane Doe"}],
        "notes": None,
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Language validation
# ---------------------------------------------------------------------------


def test_valid_language_en():
    r = ExtractionResult.model_validate(_minimal_result(language="en"))
    assert r.language == "en"


def test_valid_language_fr():
    r = ExtractionResult.model_validate(_minimal_result(language="fr"))
    assert r.language == "fr"


def test_valid_language_ar():
    r = ExtractionResult.model_validate(_minimal_result(language="ar"))
    assert r.language == "ar"


def test_unsupported_language_rejected():
    with pytest.raises(ValidationError):
        ExtractionResult.model_validate(_minimal_result(language="de"))


def test_unsupported_language_es_rejected():
    with pytest.raises(ValidationError):
        ExtractionResult.model_validate(_minimal_result(language="es"))


# ---------------------------------------------------------------------------
# Extra fields ignored
# ---------------------------------------------------------------------------


def test_extra_fields_ignored():
    data = _minimal_result()
    data["role"] = "admin"
    data["extraction_status"] = "succeeded"
    r = ExtractionResult.model_validate(data)
    assert not hasattr(r, "role")
    assert not hasattr(r, "extraction_status")


# ---------------------------------------------------------------------------
# Missing locale keys filled
# ---------------------------------------------------------------------------


def test_missing_locale_keys_filled_with_none_for_title():
    r = ExtractionResult.model_validate(
        _minimal_result(title={"en": "Only English"})
    )
    assert r.title["en"] == "Only English"
    assert r.title["fr"] is None
    assert r.title["ar"] is None


def test_missing_locale_keys_filled_with_empty_list_for_keywords():
    r = ExtractionResult.model_validate(
        _minimal_result(keywords={"en": ["kw1"]})
    )
    assert r.keywords["en"] == ["kw1"]
    assert r.keywords["fr"] == []
    assert r.keywords["ar"] == []


def test_missing_locale_keys_filled_for_abstract():
    r = ExtractionResult.model_validate(
        _minimal_result(abstract={"ar": "ملخص"})
    )
    assert r.abstract["ar"] == "ملخص"
    assert r.abstract["en"] is None
    assert r.abstract["fr"] is None


# ---------------------------------------------------------------------------
# Unknown locale keys dropped
# ---------------------------------------------------------------------------


def test_unknown_locale_dropped_from_title():
    r = ExtractionResult.model_validate(
        _minimal_result(title={"en": "Title", "de": "Titel", "zh": "标题"})
    )
    assert "de" not in r.title
    assert "zh" not in r.title
    assert r.title["en"] == "Title"


def test_unknown_locale_dropped_from_keywords():
    r = ExtractionResult.model_validate(
        _minimal_result(keywords={"en": ["kw"], "es": ["palabra"]})
    )
    assert "es" not in r.keywords
    assert r.keywords["en"] == ["kw"]


# ---------------------------------------------------------------------------
# No title at all rejected
# ---------------------------------------------------------------------------


def test_no_title_rejected():
    with pytest.raises(ValidationError):
        ExtractionResult.model_validate(
            _minimal_result(title={"en": None, "fr": None, "ar": None})
        )


def test_empty_title_strings_rejected():
    with pytest.raises(ValidationError):
        ExtractionResult.model_validate(
            _minimal_result(title={"en": "   ", "fr": "", "ar": None})
        )


# ---------------------------------------------------------------------------
# Title whitespace normalization
# ---------------------------------------------------------------------------


def test_title_leading_trailing_whitespace_stripped():
    r = ExtractionResult.model_validate(
        _minimal_result(title={"en": "  Hello World  "})
    )
    assert r.title["en"] == "Hello World"


def test_title_internal_whitespace_collapsed():
    r = ExtractionResult.model_validate(
        _minimal_result(title={"en": "Hello   World\t  Here"})
    )
    assert r.title["en"] == "Hello World Here"


def test_title_max_500_chars():
    long_title = "A" * 600
    r = ExtractionResult.model_validate(_minimal_result(title={"en": long_title}))
    assert len(r.title["en"]) == 500


# ---------------------------------------------------------------------------
# Abstract whitespace normalization (paragraph breaks preserved)
# ---------------------------------------------------------------------------


def test_abstract_paragraph_breaks_preserved():
    r = ExtractionResult.model_validate(
        _minimal_result(abstract={"en": "Para one.\n\nPara two."})
    )
    assert "\n" in r.abstract["en"]


def test_abstract_max_8000_chars():
    long_abstract = "A" * 9000
    r = ExtractionResult.model_validate(_minimal_result(abstract={"en": long_abstract}))
    assert len(r.abstract["en"]) == 8000


# ---------------------------------------------------------------------------
# Keyword normalization
# ---------------------------------------------------------------------------


def test_keyword_trailing_period_stripped():
    r = ExtractionResult.model_validate(
        _minimal_result(keywords={"en": ["machine learning."]})
    )
    assert "machine learning" in r.keywords["en"]


def test_keyword_trailing_semicolon_stripped():
    r = ExtractionResult.model_validate(
        _minimal_result(keywords={"en": ["natural language processing;"]})
    )
    assert "natural language processing" in r.keywords["en"]


def test_keyword_trailing_comma_stripped():
    r = ExtractionResult.model_validate(
        _minimal_result(keywords={"en": ["deep learning,"]})
    )
    assert "deep learning" in r.keywords["en"]


def test_keyword_dedup_case_insensitive():
    r = ExtractionResult.model_validate(
        _minimal_result(
            keywords={"en": ["Machine Learning", "machine learning", "MACHINE LEARNING"]}
        )
    )
    assert r.keywords["en"].count("Machine Learning") == 1
    assert len(r.keywords["en"]) == 1


def test_keyword_dedup_keeps_first_occurrence():
    r = ExtractionResult.model_validate(
        _minimal_result(keywords={"en": ["Alpha", "alpha", "ALPHA"]})
    )
    assert r.keywords["en"][0] == "Alpha"


def test_keyword_max_15_per_language():
    kws = [f"keyword{i}" for i in range(20)]
    r = ExtractionResult.model_validate(_minimal_result(keywords={"en": kws}))
    assert len(r.keywords["en"]) == 15


def test_keyword_max_120_chars():
    long_kw = "A" * 150
    r = ExtractionResult.model_validate(_minimal_result(keywords={"en": [long_kw]}))
    assert len(r.keywords["en"][0]) == 120


def test_keyword_empty_strings_dropped():
    r = ExtractionResult.model_validate(
        _minimal_result(keywords={"en": ["valid", "", "  ", "also valid"]})
    )
    assert "" not in r.keywords["en"]
    assert "   " not in r.keywords["en"]
    assert len(r.keywords["en"]) == 2


# ---------------------------------------------------------------------------
# Notes normalization
# ---------------------------------------------------------------------------


def test_notes_max_500_chars():
    r = ExtractionResult.model_validate(_minimal_result(notes="N" * 600))
    assert len(r.notes) == 500


def test_notes_none_when_empty():
    r = ExtractionResult.model_validate(_minimal_result(notes=""))
    assert r.notes is None


# ---------------------------------------------------------------------------
# Authors max 50
# ---------------------------------------------------------------------------


def test_authors_max_50():
    authors = [{"full_name": f"Author {i}"} for i in range(60)]
    r = ExtractionResult.model_validate(_minimal_result(authors=authors))
    assert len(r.authors) == 50


# ---------------------------------------------------------------------------
# ExtractedAuthor validation
# ---------------------------------------------------------------------------


def test_author_full_name_required():
    with pytest.raises(ValidationError):
        ExtractedAuthor.model_validate({"full_name": ""})


def test_author_full_name_whitespace_only_rejected():
    with pytest.raises(ValidationError):
        ExtractedAuthor.model_validate({"full_name": "   "})


def test_author_extra_fields_ignored():
    a = ExtractedAuthor.model_validate({"full_name": "Jane", "role": "admin", "secret": "xyz"})
    assert not hasattr(a, "role")
    assert not hasattr(a, "secret")


# ---------------------------------------------------------------------------
# ORCID validation
# ---------------------------------------------------------------------------


def test_orcid_valid():
    a = ExtractedAuthor.model_validate(
        {"full_name": "A", "orcid": "0000-0002-1825-0097"}
    )
    assert a.orcid == "0000-0002-1825-0097"


def test_orcid_valid_ending_x():
    a = ExtractedAuthor.model_validate(
        {"full_name": "A", "orcid": "0000-0002-1825-009X"}
    )
    assert a.orcid == "0000-0002-1825-009X"


def test_orcid_invalid_becomes_none():
    a = ExtractedAuthor.model_validate(
        {"full_name": "A", "orcid": "not-an-orcid"}
    )
    assert a.orcid is None


def test_orcid_too_short_becomes_none():
    a = ExtractedAuthor.model_validate({"full_name": "A", "orcid": "0000-0002-1825"})
    assert a.orcid is None


# ---------------------------------------------------------------------------
# Email validation
# ---------------------------------------------------------------------------


def test_email_valid():
    a = ExtractedAuthor.model_validate({"full_name": "A", "email": "user@example.com"})
    assert a.email == "user@example.com"


def test_email_invalid_no_at_sign():
    a = ExtractedAuthor.model_validate({"full_name": "A", "email": "notanemail"})
    assert a.email is None


def test_email_invalid_no_domain():
    a = ExtractedAuthor.model_validate({"full_name": "A", "email": "user@"})
    assert a.email is None


def test_email_none_stays_none():
    a = ExtractedAuthor.model_validate({"full_name": "A", "email": None})
    assert a.email is None


# ---------------------------------------------------------------------------
# Affiliations normalization
# ---------------------------------------------------------------------------


def test_affiliations_empty_strings_dropped():
    a = ExtractedAuthor.model_validate(
        {"full_name": "A", "affiliations": ["Univ. X", "", "  ", "Dept. Y"]}
    )
    assert "" not in a.affiliations
    assert len(a.affiliations) == 2


def test_affiliations_whitespace_stripped():
    a = ExtractedAuthor.model_validate(
        {"full_name": "A", "affiliations": ["  University of X  "]}
    )
    assert a.affiliations[0] == "University of X"
