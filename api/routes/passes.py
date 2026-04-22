"""POST /passes — predict visibility windows for a query + observer + window."""
from __future__ import annotations

from typing import Annotated, Union

from fastapi import APIRouter, Depends, HTTPException
from skyfield.api import Timescale
from skyfield.jpllib import SpiceKernel

from api.deps import get_ephemeris, get_terrain_fetcher, get_timescale, get_tle_fetcher
from api.schemas.requests import PassesRequest
from api.schemas.responses import (
    PassesResponse,
    PassResponse,
    TrainPassResponse,
    pass_to_response,
    trainpass_to_response,
)
from core._types import Observer, Pass, TLE
from core.catalog.fetcher import TLEFetcher
from core.catalog.search import DEFAULT_CATALOG, resolve
from core.orbital.passes import predict_passes
from core.terrain.fetcher import TerrainFetcher
from core.trains.clustering import group_into_trains
from core.visibility.filter import filter_passes

router = APIRouter()


def _observer_from_request(req: PassesRequest) -> Observer:
    """Build an Observer from a PassesRequest."""
    return Observer(lat=req.lat, lng=req.lng, elevation_m=req.elevation_m)


@router.post("/passes", response_model=PassesResponse)
def post_passes(
    req: PassesRequest,
    tle_fetcher: Annotated[TLEFetcher, Depends(get_tle_fetcher)],
    terrain: Annotated[TerrainFetcher, Depends(get_terrain_fetcher)],
    timescale: Annotated[Timescale, Depends(get_timescale)],
    ephemeris: Annotated[SpiceKernel, Depends(get_ephemeris)],
) -> PassesResponse:
    """Resolve query, fetch TLEs, predict passes, filter by mode, cluster trains."""
    try:
        resolution = resolve(req.query, catalog=DEFAULT_CATALOG)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    observer = _observer_from_request(req)
    horizon = terrain.get_horizon_mask(observer)

    tles: list[TLE] = []
    ages: list[float] = []
    if resolution.type == "single":
        tle, age = tle_fetcher.get_tle(resolution.norad_ids[0])
        tles.append(tle)
        ages.append(age)
    else:
        # Use group endpoint for efficiency. `resolution.display_name` is the group name.
        group_tles, age = tle_fetcher.get_group_tles(resolution.display_name)
        # Filter to the ids we resolved (some group endpoints return extras).
        wanted = set(resolution.norad_ids)
        tles.extend(t for t in group_tles if t.norad_id in wanted)
        ages.append(age)

    all_passes: list[Pass] = []
    for tle in tles:
        tle_passes = predict_passes(
            tle, observer, req.from_utc, req.to_utc,
            timescale=timescale,
            horizon_mask=horizon,
        )
        filtered = filter_passes(
            tle_passes, tle, observer,
            mode=req.mode,
            timescale=timescale,
            ephemeris=ephemeris,
            min_magnitude=req.min_magnitude,
        )
        all_passes.extend(filtered)
    all_passes.sort(key=lambda p: p.rise.time)

    grouped = group_into_trains(all_passes) if resolution.type == "group" else all_passes

    items: list[Union[PassResponse, TrainPassResponse]] = []
    for event in grouped:
        if isinstance(event, Pass):
            items.append(pass_to_response(event))
        else:
            items.append(trainpass_to_response(event))

    return PassesResponse(
        query=req.query,
        resolved_name=resolution.display_name,
        passes=items,
        tle_age_seconds=ages[0] if ages else None,
    )
