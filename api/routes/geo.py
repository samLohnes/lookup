"""GET /geo/timezone and /geo/elevation — location-derived metadata lookups."""
from __future__ import annotations

from functools import lru_cache
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import get_terrain_fetcher
from api.schemas.responses import ElevationResponse, GeoTimezoneResponse
from core.terrain.fetcher import TerrainFetcher
from core.terrain.opentopo import OpenTopoError

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


# Half-width of the DEM tile fetched per elevation lookup. 1 km is plenty
# for a single-point sample and keeps OpenTopography traffic minimal.
_ELEVATION_TILE_RADIUS_KM = 1


@router.get("/geo/elevation", response_model=ElevationResponse)
def get_geo_elevation(
    terrain: Annotated[TerrainFetcher, Depends(get_terrain_fetcher)],
    lat: Annotated[float, Query(ge=-90.0, le=90.0)],
    lng: Annotated[float, Query(ge=-180.0, le=180.0)],
) -> ElevationResponse:
    """Return the DEM-sampled terrain elevation (m above sea level) at (lat, lng).

    Fetches a 1 km half-width DEM tile via OpenTopography (cached on disk
    via the same machinery used for horizon masks) and samples the centre
    pixel. Used by the frontend to auto-populate `observer.elevation_m`
    when the user moves the observer to a new location.

    Errors:
        500 — OpenTopography API key missing (handled globally as
            `OpenTopoError` → 500).
        502 — DEM fetch failed for any other reason (network, upstream
            HTTP error, polar / antimeridian rejection from
            `bbox_for_radius_km`).
    """
    try:
        elevation_m = terrain.get_elevation_m(
            lat=lat, lng=lng, radius_km=_ELEVATION_TILE_RADIUS_KM
        )
    except OpenTopoError as exc:
        # Distinguish "config missing" (handled globally → 500) from
        # "fetch failed for this point" (502 — upstream / bbox issue).
        msg = str(exc)
        if "API key" in msg:
            raise
        raise HTTPException(status_code=502, detail=f"DEM fetch failed: {msg}") from exc
    return ElevationResponse(lat=lat, lng=lng, elevation_m=elevation_m)
