"""Disk cache for computed horizon masks.

Keyed identically to the DEM cache so a given observer maps consistently
from DEM fetch → horizon compute → mask cache.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Optional

from core._types import HorizonMask

_LL_ROUND_DIGITS = 4


def mask_cache_key(
    *, lat: float, lng: float, radius_km: float, elevation_m: float
) -> str:
    """Stable 16-char hash over rounded lat/lng + radius + observer elevation.

    `elevation_m` MUST be part of the key — the horizon mask changes
    significantly with observer height (standing on a mountain sees a
    mostly-clear horizon; standing at its base sees peaks towering above).
    Excluding it from the key serves stale masks to users who moved
    observers between elevations at the same lat/lng.

    Args:
        lat: Latitude in degrees.
        lng: Longitude in degrees.
        radius_km: Query radius in kilometres.
        elevation_m: Observer elevation above sea level (metres). Rounded
            to whole metres for the key — sub-metre precision doesn't
            meaningfully change the mask.
    """
    tag = (
        f"{round(lat, _LL_ROUND_DIGITS)}_"
        f"{round(lng, _LL_ROUND_DIGITS)}_"
        f"{int(radius_km)}_"
        f"{int(round(elevation_m))}"
    )
    return hashlib.sha256(tag.encode("utf-8")).hexdigest()[:16]


class HorizonMaskCache:
    """Stores computed HorizonMask objects as JSON."""

    def __init__(self, *, root: Path | str) -> None:
        """Initialise cache, creating the directory tree if needed.

        Args:
            root: Base directory; masks are stored under <root>/horizon-cache/.
        """
        self._root = Path(root) / "horizon-cache"
        self._root.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        """Return the filesystem path for a given cache key."""
        return self._root / f"{key}.json"

    def save(self, key: str, mask: HorizonMask) -> None:
        """Serialise a HorizonMask to disk as JSON.

        Args:
            key: Cache key produced by `mask_cache_key`.
            mask: The computed horizon mask to persist.
        """
        payload = {"samples_deg": list(mask.samples_deg)}
        self._path(key).write_text(json.dumps(payload))

    def load(self, key: str) -> Optional[HorizonMask]:
        """Load a cached HorizonMask, or return None on a miss.

        Args:
            key: Cache key produced by `mask_cache_key`.
        """
        path = self._path(key)
        if not path.exists():
            return None
        payload = json.loads(path.read_text())
        return HorizonMask(samples_deg=tuple(float(v) for v in payload["samples_deg"]))
