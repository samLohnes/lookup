"""Tests for core.catalog.search train_query support."""
from __future__ import annotations

from core.catalog.search import CatalogIndex, fuzzy_search, resolve


def _catalog_with_both() -> CatalogIndex:
    """A catalog that has both a 'starlink' group and a 'starlink (trains)'
    train_query — to verify train_query wins on equal scores."""
    return CatalogIndex(
        satellites=(),
        groups=(("stations", (25544, 48274)),),
        train_queries=(("starlink (trains)", "starlink"),),
    )


def test_train_query_match_type_is_train_query():
    hits = fuzzy_search("starlink", catalog=_catalog_with_both())
    assert hits, "expected at least one hit"
    train_hits = [h for h in hits if h.match_type == "train_query"]
    assert train_hits, "expected the starlink (trains) entry"
    assert train_hits[0].display_name == "starlink (trains)"
    assert train_hits[0].query_kind == "starlink"
    assert train_hits[0].norad_ids == ()


def test_resolve_returns_train_query_with_kind():
    r = resolve("starlink", catalog=_catalog_with_both())
    assert r.type == "train_query"
    assert r.query_kind == "starlink"


def test_train_query_priority_over_group_at_equal_score():
    """If a query matches both a group and a train_query equally, train_query wins."""
    catalog = CatalogIndex(
        satellites=(),
        groups=(("foo", (1, 2)),),
        train_queries=(("foo", "foo"),),
    )
    hits = fuzzy_search("foo", catalog=catalog)
    assert hits[0].match_type == "train_query"
