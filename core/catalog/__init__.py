"""Catalog — satellite lookup + TLE parsing."""
from __future__ import annotations

__all__ = [
    "DEFAULT_CATALOG",
    "CatalogIndex",
    "fuzzy_search",
    "parse_tle",
    "parse_tle_file",
    "resolve",
]


def __getattr__(name: str):  # pragma: no cover
    """Lazy import to avoid circular dependencies."""
    if name in ("DEFAULT_CATALOG", "CatalogIndex", "fuzzy_search", "resolve"):
        from core.catalog import search
        if name == "DEFAULT_CATALOG":
            return search.DEFAULT_CATALOG
        elif name == "CatalogIndex":
            return search.CatalogIndex
        elif name == "fuzzy_search":
            return search.fuzzy_search
        elif name == "resolve":
            return search.resolve
    elif name in ("parse_tle", "parse_tle_file"):
        from core.catalog import tle_parser
        if name == "parse_tle":
            return tle_parser.parse_tle
        elif name == "parse_tle_file":
            return tle_parser.parse_tle_file
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
