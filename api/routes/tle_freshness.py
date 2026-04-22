"""GET /tle-freshness — surface the cached TLE age for a query."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import get_tle_fetcher
from api.schemas.responses import TLEFreshnessResponse
from core.catalog.fetcher import TLEFetcher
from core.catalog.search import DEFAULT_CATALOG, resolve

router = APIRouter()


@router.get("/tle-freshness", response_model=list[TLEFreshnessResponse])
def get_tle_freshness(
    query: Annotated[str, Query(min_length=1)],
    tle_fetcher: Annotated[TLEFetcher, Depends(get_tle_fetcher)],
) -> list[TLEFreshnessResponse]:
    """Return TLE age metadata for each satellite matching the query."""
    try:
        resolution = resolve(query, catalog=DEFAULT_CATALOG)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    out: list[TLEFreshnessResponse] = []
    if resolution.type == "single":
        tle, age = tle_fetcher.get_tle(resolution.norad_ids[0])
        out.append(TLEFreshnessResponse(
            norad_id=tle.norad_id,
            name=tle.name,
            tle_epoch=tle.epoch,
            fetched_age_seconds=age,
        ))
    else:
        tles, age = tle_fetcher.get_group_tles(resolution.display_name)
        wanted = set(resolution.norad_ids)
        for t in tles:
            if t.norad_id not in wanted:
                continue
            out.append(TLEFreshnessResponse(
                norad_id=t.norad_id,
                name=t.name,
                tle_epoch=t.epoch,
                fetched_age_seconds=age,
            ))
    return out
