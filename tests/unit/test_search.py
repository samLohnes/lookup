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


def test_fuzzy_search_starlink_resolves_to_train_query():
    """'starlink' now matches the new train_query entry, not the old group."""
    hits = fuzzy_search("starlink", catalog=DEFAULT_CATALOG)
    train_hits = [h for h in hits if h.match_type == "train_query"]
    assert train_hits, "expected at least one train_query hit"
    assert train_hits[0].display_name == "starlink (trains)"
    assert train_hits[0].query_kind == "starlink"


def test_fuzzy_search_typo_resolves():
    # "stalink" -> "starlink (trains)"
    hits = fuzzy_search("stalink", catalog=DEFAULT_CATALOG)
    assert any(h.display_name == "starlink (trains)" for h in hits)


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


def test_resolve_group_stations():
    """Stations is still a (small, curated) group."""
    r = resolve("stations", catalog=DEFAULT_CATALOG)
    assert r.type == "group"
    assert len(r.norad_ids) >= 2
    assert r.display_name == "stations"


def test_resolve_train_query_starlink():
    """Starlink is now a train_query, not a group."""
    r = resolve("starlink", catalog=DEFAULT_CATALOG)
    assert r.type == "train_query"
    assert r.display_name == "starlink (trains)"
    assert r.query_kind == "starlink"
    assert r.norad_ids == ()  # discovery resolves at query time, not catalog time


def test_resolve_no_match_raises():
    with pytest.raises(LookupError, match="no match"):
        resolve("NOTAREALSATELLITE", catalog=DEFAULT_CATALOG)


def test_catalog_index_allows_custom_catalog():
    custom = CatalogIndex(
        satellites=(
            ("FOO SAT", 12345),
        ),
        groups=(),
        train_queries=(),
    )
    hits = fuzzy_search("foo", catalog=custom)
    assert hits[0].norad_ids == (12345,)
