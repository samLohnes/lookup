"""POST /sky-track — dense TrackSample entries over a short window."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from skyfield.api import Timescale
from skyfield.jpllib import SpiceKernel

from api.deps import get_ephemeris, get_timescale, get_tle_fetcher
from api.schemas.requests import SkyTrackRequest
from api.schemas.responses import SkyTrackResponse, TrackSampleResponse, track_sample_to_response
from core._types import Observer
from core.catalog.fetcher import TLEFetcher
from core.catalog.search import DEFAULT_CATALOG, resolve
from core.orbital.tracking import sample_track

router = APIRouter()


@router.post("/sky-track", response_model=SkyTrackResponse)
def post_sky_track(
    req: SkyTrackRequest,
    tle_fetcher: Annotated[TLEFetcher, Depends(get_tle_fetcher)],
    timescale: Annotated[Timescale, Depends(get_timescale)],
    ephemeris: Annotated[SpiceKernel, Depends(get_ephemeris)],
) -> SkyTrackResponse:
    """Resolve a single satellite, fetch its TLE, and sample its track over the window."""
    try:
        resolution = resolve(req.query, catalog=DEFAULT_CATALOG)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if resolution.type != "single":
        raise HTTPException(
            status_code=400,
            detail="sky-track expects a single satellite, not a group",
        )

    tle, _ = tle_fetcher.get_tle(resolution.norad_ids[0])
    observer = Observer(lat=req.lat, lng=req.lng, elevation_m=req.elevation_m)

    samples = sample_track(
        tle, observer, req.from_utc, req.to_utc,
        timescale=timescale,
        ephemeris=ephemeris,
        dt_seconds=req.dt_seconds,
    )

    return SkyTrackResponse(
        resolved_name=resolution.display_name,
        samples=[track_sample_to_response(s) for s in samples],
    )
