"""GET /catalog/search — fuzzy satellite lookup, no TLE fetching."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from api.schemas.responses import CatalogHitResponse
from core.catalog.search import DEFAULT_CATALOG, fuzzy_search

router = APIRouter()


@router.get("/catalog/search", response_model=list[CatalogHitResponse])
def get_catalog_search(
    q: Annotated[str, Query(min_length=1, description="Free-text query")],
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> list[CatalogHitResponse]:
    """Return fuzzy-matched catalog entries for the given query string."""
    hits = fuzzy_search(q, catalog=DEFAULT_CATALOG, limit=limit)
    return [
        CatalogHitResponse(
            display_name=h.display_name,
            match_type=h.match_type,
            norad_ids=list(h.norad_ids),
            score=h.score,
        )
        for h in hits
    ]
