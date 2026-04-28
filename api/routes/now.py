"""POST /now-positions and POST /now-tracks — live-mode endpoints.

Both stateless: no per-session storage, no caching beyond what the
underlying TLE fetcher already does. Reuse `core.orbital.tracking`.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from skyfield.api import Timescale
from skyfield.jpllib import SpiceKernel

from api.deps import get_ephemeris, get_timescale, get_tle_fetcher
from api.schemas.requests import NowPositionsRequest, NowTracksRequest
from api.schemas.responses import (
    NowPositionEntry,
    NowPositionsResponse,
    NowTrackEntry,
    NowTracksResponse,
    track_sample_to_response,
)
from core._types import Observer
from core.catalog.celestrak import CelestrakError
from core.catalog.fetcher import TLEFetcher
from core.orbital.tracking import sample_at, sample_track

router = APIRouter()


@router.post("/now-positions", response_model=NowPositionsResponse)
def post_now_positions(
    req: NowPositionsRequest,
    tle_fetcher: Annotated[TLEFetcher, Depends(get_tle_fetcher)],
    timescale: Annotated[Timescale, Depends(get_timescale)],
    ephemeris: Annotated[SpiceKernel, Depends(get_ephemeris)],
) -> NowPositionsResponse:
    """One TrackSample per requested satellite, at the moment of the call."""
    now = datetime.now(timezone.utc)
    observer = Observer(lat=req.lat, lng=req.lng, elevation_m=req.elevation_m)
    entries: list[NowPositionEntry] = []
    for nid in req.norad_ids:
        try:
            tle, _ = tle_fetcher.get_tle(nid)
        except (LookupError, CelestrakError) as exc:
            raise HTTPException(status_code=404, detail=f"NORAD {nid} not found") from exc
        sample = sample_at(tle, observer, now, timescale=timescale, ephemeris=ephemeris)
        entries.append(NowPositionEntry(
            norad_id=nid,
            sample=track_sample_to_response(sample),
        ))
    return NowPositionsResponse(entries=entries)


@router.post("/now-tracks", response_model=NowTracksResponse)
def post_now_tracks(
    req: NowTracksRequest,
    tle_fetcher: Annotated[TLEFetcher, Depends(get_tle_fetcher)],
    timescale: Annotated[Timescale, Depends(get_timescale)],
    ephemeris: Annotated[SpiceKernel, Depends(get_ephemeris)],
) -> NowTracksResponse:
    """Trailing track per requested satellite, last `tail_minutes`."""
    now = datetime.now(timezone.utc)
    start = now - timedelta(minutes=req.tail_minutes)
    observer = Observer(lat=req.lat, lng=req.lng, elevation_m=req.elevation_m)
    entries: list[NowTrackEntry] = []
    for nid in req.norad_ids:
        try:
            tle, _ = tle_fetcher.get_tle(nid)
        except (LookupError, CelestrakError) as exc:
            raise HTTPException(status_code=404, detail=f"NORAD {nid} not found") from exc
        samples = sample_track(
            tle, observer, start, now,
            timescale=timescale, ephemeris=ephemeris,
            dt_seconds=req.dt_seconds,
        )
        entries.append(NowTrackEntry(
            norad_id=nid,
            samples=[track_sample_to_response(s) for s in samples],
        ))
    return NowTracksResponse(entries=entries)
