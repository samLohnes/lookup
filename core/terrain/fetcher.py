"""Terrain orchestrator — DEM fetch + DEM cache + horizon compute + mask cache.

Exposes `get_horizon_mask(observer) -> HorizonMask`, the public engine API.
Order of operations:
    1. Check mask cache → return immediately if present.
    2. Check DEM cache → load if present, else fetch + save.
    3. Compute horizon mask from DEM.
    4. Save mask to cache.
    5. Return.
"""
from __future__ import annotations

from pathlib import Path

from core._types import HorizonMask, Observer
from core.terrain.dem_cache import DEMCache, dem_cache_key
from core.terrain.horizon import compute_horizon_mask
from core.terrain.mask_cache import HorizonMaskCache, mask_cache_key
from core.terrain.opentopo import OpenTopoClient

DEFAULT_RADIUS_KM = 50


class TerrainFetcher:
    """Read-through cache stack for per-location horizon masks."""

    def __init__(
        self,
        *,
        client: OpenTopoClient,
        cache_root: Path | str,
        radius_km: int = DEFAULT_RADIUS_KM,
    ) -> None:
        """Initialise the fetcher with a client and cache directory.

        Args:
            client: OpenTopography client used to fetch DEM tiles on a miss.
            cache_root: Root directory under which DEM and mask caches are stored.
            radius_km: Bounding-box half-width used for DEM fetch and cache keying.
        """
        self._client = client
        self._dem_cache = DEMCache(root=cache_root)
        self._mask_cache = HorizonMaskCache(root=cache_root)
        self._radius_km = radius_km

    def get_horizon_mask(self, observer: Observer) -> HorizonMask:
        """Return a 360-degree horizon mask for `observer`, using caches when available.

        Args:
            observer: The observation location.
        """
        key = mask_cache_key(
            lat=observer.lat,
            lng=observer.lng,
            radius_km=self._radius_km,
            elevation_m=observer.elevation_m,
        )

        cached_mask = self._mask_cache.load(key)
        if cached_mask is not None:
            return cached_mask

        dem = self._load_or_fetch_dem(
            lat=observer.lat, lng=observer.lng, radius_km=self._radius_km
        )
        mask = compute_horizon_mask(dem=dem, observer=observer)
        self._mask_cache.save(key, mask)
        return mask

    def get_elevation_m(self, *, lat: float, lng: float, radius_km: int = 1) -> float:
        """Sample DEM elevation (metres above sea level) at the centre of a tile.

        Fetches a small DEM tile around (lat, lng) — defaulting to a 1 km
        half-width box — and returns the elevation at the centre pixel.
        Reuses the same DEM cache as `get_horizon_mask`; the cache key
        already includes `radius_km`, so small probe tiles never collide
        with the larger horizon-mask tiles.

        Args:
            lat: Observer latitude in degrees.
            lng: Observer longitude in degrees.
            radius_km: Half-width of the DEM tile to fetch. 1 km is plenty
                for a single-point sample and keeps OpenTopography traffic
                tiny.
        """
        dem = self._load_or_fetch_dem(lat=lat, lng=lng, radius_km=radius_km)
        rows, cols = dem.shape
        return float(dem.elevations[rows // 2, cols // 2])

    def _load_or_fetch_dem(self, *, lat: float, lng: float, radius_km: int):
        """Return a cached DEM tile, fetching + saving on a miss."""
        dem_key = dem_cache_key(lat=lat, lng=lng, radius_km=radius_km)
        dem = self._dem_cache.load(dem_key)
        if dem is None:
            tiff_bytes = self._client.fetch(lat=lat, lng=lng, radius_km=radius_km)
            self._dem_cache.save_bytes(dem_key, tiff_bytes)
            dem = self._dem_cache.load(dem_key)
            if dem is None:
                raise RuntimeError("DEM cache load failed immediately after save — check disk space/permissions")
        return dem
