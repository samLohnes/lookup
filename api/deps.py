"""FastAPI dependency providers — the hooks tests override for mocking."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends
from skyfield.api import Loader, Timescale
from skyfield.jpllib import SpiceKernel

from api.settings import Settings
from core.catalog.celestrak import CelestrakClient
from core.catalog.fetcher import TLEFetcher
from core.terrain.fetcher import TerrainFetcher
from core.terrain.opentopo import OpenTopoClient


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings instance loaded from env/defaults."""
    return Settings()


@lru_cache(maxsize=1)
def _skyfield_loader(cache_root: str) -> Loader:
    """Return a Skyfield Loader backed by the given cache directory."""
    cache = Path(cache_root) / "skyfield-cache"
    cache.mkdir(parents=True, exist_ok=True)
    return Loader(str(cache))


def get_timescale(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Timescale:
    """Provide a Skyfield Timescale for the current settings."""
    return _skyfield_loader(settings.cache_root).timescale()


def get_ephemeris(
    settings: Annotated[Settings, Depends(get_settings)],
) -> SpiceKernel:
    """Provide the DE421 ephemeris kernel."""
    return _skyfield_loader(settings.cache_root)("de421.bsp")


def get_tle_fetcher(
    settings: Annotated[Settings, Depends(get_settings)],
) -> TLEFetcher:
    """Provide a TLEFetcher backed by Celestrak and the configured cache."""
    return TLEFetcher(
        client=CelestrakClient(),
        cache_root=Path(settings.cache_root),
    )


def get_terrain_fetcher(
    settings: Annotated[Settings, Depends(get_settings)],
) -> TerrainFetcher:
    """Provide a TerrainFetcher backed by OpenTopography and the configured cache."""
    return TerrainFetcher(
        client=OpenTopoClient(api_key=settings.opentopography_api_key),
        cache_root=Path(settings.cache_root),
        radius_km=settings.horizon_radius_km,
    )
