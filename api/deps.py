"""FastAPI dependency providers — the hooks tests override for mocking."""
from __future__ import annotations

from datetime import timedelta
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


@lru_cache(maxsize=1)
def _build_tle_fetcher(cache_root: str, max_age_hours: int) -> TLEFetcher:
    """Construct a singleton TLEFetcher; keyed so settings changes still rebuild."""
    return TLEFetcher(
        client=CelestrakClient(),
        cache_root=Path(cache_root),
        max_age=timedelta(hours=max_age_hours),
    )


def get_tle_fetcher(
    settings: Annotated[Settings, Depends(get_settings)],
) -> TLEFetcher:
    """Provide a cached TLEFetcher backed by Celestrak and the configured cache."""
    return _build_tle_fetcher(settings.cache_root, settings.tle_max_age_hours)


@lru_cache(maxsize=None)
def _build_terrain_fetcher(cache_root: str, radius_km: int, api_key: str | None) -> TerrainFetcher:
    """Construct a singleton TerrainFetcher; keyed on (cache_root, radius_km, api_key)."""
    return TerrainFetcher(
        client=OpenTopoClient(api_key=api_key),
        cache_root=Path(cache_root),
        radius_km=radius_km,
    )


def get_terrain_fetcher(
    settings: Annotated[Settings, Depends(get_settings)],
) -> TerrainFetcher:
    """Provide a cached TerrainFetcher backed by OpenTopography and the configured cache."""
    api_key = settings.opentopography_api_key.get_secret_value() if settings.opentopography_api_key else None
    return _build_terrain_fetcher(settings.cache_root, settings.horizon_radius_km, api_key)
