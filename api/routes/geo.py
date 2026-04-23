"""GET /geo/timezone — IANA timezone lookup for a lat/lng."""
from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from api.schemas.responses import GeoTimezoneResponse

router = APIRouter()


@lru_cache(maxsize=1)
def _finder():
    """Lazy-load the TimezoneFinder. Construction is slow (~200ms first time)."""
    from timezonefinder import TimezoneFinder
    return TimezoneFinder()


@router.get("/geo/timezone", response_model=GeoTimezoneResponse)
def get_geo_timezone(
    lat: Annotated[float, Query(ge=-90.0, le=90.0)],
    lng: Annotated[float, Query(ge=-180.0, le=180.0)],
) -> GeoTimezoneResponse:
    """Return the IANA timezone at (lat, lng).

    Uses `timezonefinder` (offline polygon lookup). For points in open
    ocean, falls back to an `Etc/GMT±N` zone based on the longitude.
    """
    tz = _finder().timezone_at(lat=lat, lng=lng)
    if tz is None:
        # timezonefinder returns None for a few Antarctic edge cases; fall
        # back to UTC-offset math for those.
        offset_hours = -round(lng / 15)  # Etc/GMT has inverted sign per POSIX
        sign = "+" if offset_hours >= 0 else "-"
        tz = f"Etc/GMT{sign}{abs(offset_hours)}"
        if abs(offset_hours) == 0:
            tz = "Etc/UTC"
    if tz is None:
        raise HTTPException(status_code=500, detail=f"no timezone for ({lat}, {lng})")
    return GeoTimezoneResponse(lat=lat, lng=lng, timezone=tz)
