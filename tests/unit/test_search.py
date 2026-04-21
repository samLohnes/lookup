"""Tests for core.catalog.search."""
from __future__ import annotations

import pytest

from core.catalog.search import (
    DEFAULT_CATALOG,
    CatalogIndex,
    fuzzy_search,
    resolve,
)


def test_fuzzy_search_exact_name():
    hits = fuzzy_search("ISS", catalog=DEFAULT_CATALOG)
    assert hits, "expected at least one hit"
    assert hits[0].display_name == "ISS (ZARYA)"
    assert hits[0].match_type == "satellite"
    assert 25544 in hits[0].norad_ids


def test_fuzzy_search_partial_name():
    hits = fuzzy_search("hubble", catalog=DEFAULT_CATALOG)
    assert any("HUBBLE" in h.display_name.upper() for h in hits)


def test_fuzzy_search_group_starlink():
    hits = fuzzy_search("starlink", catalog=DEFAULT_CATALOG)
    group_hits = [h for h in hits if h.match_type == "group"]
    assert group_hits, "expected at least one group hit"
    assert any(h.display_name == "starlink" for h in group_hits)


def test_fuzzy_search_typo_resolves():
    # "stalink" -> "starlink"
    hits = fuzzy_search("stalink", catalog=DEFAULT_CATALOG)
    assert any(h.display_name == "starlink" for h in hits)


def test_fuzzy_search_norad_id_exact():
    hits = fuzzy_search("25544", catalog=DEFAULT_CATALOG)
    assert hits[0].norad_ids == (25544,)
    assert hits[0].match_type == "satellite"


def test_fuzzy_search_returns_sorted_by_score():
    hits = fuzzy_search("iss", catalog=DEFAULT_CATALOG)
    scores = [h.score for h in hits]
    assert scores == sorted(scores, reverse=True)


def test_fuzzy_search_empty_query_returns_empty():
    assert fuzzy_search("", catalog=DEFAULT_CATALOG) == []


def test_resolve_single():
    r = resolve("ISS", catalog=DEFAULT_CATALOG)
    assert r.type == "single"
    assert r.norad_ids == (25544,)
    assert r.display_name == "ISS (ZARYA)"


def test_resolve_group():
    r = resolve("starlink", catalog=DEFAULT_CATALOG)
    assert r.type == "group"
    assert len(r.norad_ids) >= 2
    assert r.display_name == "starlink"


def test_resolve_no_match_raises():
    with pytest.raises(LookupError, match="no match"):
        resolve("NOTAREALSATELLITE", catalog=DEFAULT_CATALOG)


def test_catalog_index_allows_custom_catalog():
    custom = CatalogIndex(
        satellites=(
            ("FOO SAT", 12345),
        ),
        groups=(),
    )
    hits = fuzzy_search("foo", catalog=custom)
    assert hits[0].norad_ids == (12345,)
