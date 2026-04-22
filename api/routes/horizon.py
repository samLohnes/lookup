"""GET /horizon — the 360° terrain horizon mask for an observer."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from api.deps import get_settings, get_terrain_fetcher
from api.schemas.responses import HorizonResponse
from api.settings import Settings
from core._types import Observer
from core.terrain.fetcher import TerrainFetcher

router = APIRouter()


@router.get("/horizon", response_model=HorizonResponse)
def get_horizon(
    terrain: Annotated[TerrainFetcher, Depends(get_terrain_fetcher)],
    settings: Annotated[Settings, Depends(get_settings)],
    lat: float = Query(..., ge=-90.0, le=90.0),
    lng: float = Query(..., ge=-180.0, le=180.0),
    elevation_m: float = 0.0,
) -> HorizonResponse:
    """Return the 360° terrain horizon mask for the given observer location."""
    observer = Observer(lat=lat, lng=lng, elevation_m=elevation_m)
    mask = terrain.get_horizon_mask(observer)
    return HorizonResponse(
        lat=lat,
        lng=lng,
        radius_km=settings.horizon_radius_km,
        samples_deg=list(mask.samples_deg),
    )
