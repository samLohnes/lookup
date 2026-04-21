"""Disk cache for DEM tiles.

Layout under `root`:
    <root>/dem-cache/<cache_key>.tif

`cache_key` is a stable hash of (lat_rounded, lng_rounded, radius_km) so
nearby queries reuse the same tile. Load parses the GeoTIFF into a `DEM`
dataclass using rasterio.
"""
from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Optional

import numpy as np
import rasterio

from core._types import DEM

# Round to 4 decimals ≈ 11m precision at equator — plenty for DEM tile reuse.
_LL_ROUND_DIGITS = 4


def dem_cache_key(*, lat: float, lng: float, radius_km: float) -> str:
    """Stable 16-char hash over rounded lat/lng + radius.

    Args:
        lat: Latitude in degrees.
        lng: Longitude in degrees.
        radius_km: Query radius in kilometres.
    """
    tag = f"{round(lat, _LL_ROUND_DIGITS)}_{round(lng, _LL_ROUND_DIGITS)}_{int(radius_km)}"
    return hashlib.sha256(tag.encode("utf-8")).hexdigest()[:16]


class DEMCache:
    """Saves raw GeoTIFF bytes; loads them parsed into `DEM`."""

    def __init__(self, *, root: Path | str) -> None:
        """Initialise cache, creating the directory tree if needed.

        Args:
            root: Base directory; tiles are stored under <root>/dem-cache/.
        """
        self._root = Path(root) / "dem-cache"
        self._root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        """Return the filesystem path for a given cache key."""
        return self._root / f"{key}.tif"

    def save_bytes(self, key: str, tiff_bytes: bytes) -> None:
        """Write raw GeoTIFF bytes to disk under the given key.

        Args:
            key: Cache key produced by `dem_cache_key`.
            tiff_bytes: Raw GeoTIFF content from the OpenTopography client.
        """
        self._path(key).write_bytes(tiff_bytes)

    def load(self, key: str) -> Optional[DEM]:
        """Load and parse a cached GeoTIFF into a DEM dataclass.

        Returns None on a cache miss.

        Args:
            key: Cache key produced by `dem_cache_key`.
        """
        path = self._path(key)
        if not path.exists():
            return None
        with rasterio.open(path) as src:
            elevations = src.read(1).astype(np.float32, copy=False)
            bounds = src.bounds
        return DEM(
            south_lat=float(bounds.bottom),
            north_lat=float(bounds.top),
            west_lng=float(bounds.left),
            east_lng=float(bounds.right),
            elevations=elevations,
        )
