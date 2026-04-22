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

# Defaults applied to group queries when the caller hasn't overridden.
# Spec §11.1 "apply default brightness/elevation filters for group queries".
_GROUP_DEFAULT_MIN_MAGNITUDE = 4.0      # brighter than +4
_GROUP_DEFAULT_MIN_PEAK_EL_DEG = 30.0   # peak at least 30° above horizon


def _observer_from_request(req: PassesRequest) -> Observer:
    """Build an Observer from a PassesRequest."""
    return Observer(lat=req.lat, lng=req.lng, elevation_m=req.elevation_m)


def _effective_filters(
    req: PassesRequest,
    is_group: bool,
) -> tuple[float | None, float | None]:
    """Resolve (min_magnitude, min_peak_elevation_deg) after applying group defaults.

    Group defaults only kick in when:
      * resolution is a group, AND
      * req.apply_group_defaults is True, AND
      * the specific value wasn't explicitly set by the caller.
    For single-satellite queries, the caller's values pass through unchanged.
    """
    min_mag = req.min_magnitude
    min_el = req.min_peak_elevation_deg
    if is_group and req.apply_group_defaults:
        if min_mag is None and req.mode == "naked-eye":
            min_mag = _GROUP_DEFAULT_MIN_MAGNITUDE
        if min_el is None:
            min_el = _GROUP_DEFAULT_MIN_PEAK_EL_DEG
    return min_mag, min_el


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

    is_group = resolution.type == "group"
    effective_min_mag, effective_min_el = _effective_filters(req, is_group)

    observer = _observer_from_request(req)
    horizon = terrain.get_horizon_mask(observer)

    tles: list[TLE] = []
    ages: list[float] = []
    if resolution.type == "single":
        tle, age = tle_fetcher.get_tle(resolution.norad_ids[0])
        tles.append(tle)
        ages.append(age)
    else:
        group_tles, age = tle_fetcher.get_group_tles(resolution.display_name)
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
            min_magnitude=effective_min_mag,
        )
        all_passes.extend(filtered)

    # Elevation floor applies regardless of mode (filter_passes only knows about
    # magnitude). Applied after flattening so group defaults hit group results
    # once, not per-satellite.
    if effective_min_el is not None:
        all_passes = [
            p for p in all_passes
            if p.peak.position.elevation_deg >= effective_min_el
        ]

    all_passes.sort(key=lambda p: p.rise.time)

    grouped = group_into_trains(all_passes) if is_group else all_passes

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
