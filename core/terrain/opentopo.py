"""OpenTopography DEM fetch client.

Returns raw GeoTIFF bytes for a bounding box around an observer. Parsing
into a `DEM` dataclass happens in `core.terrain.dem_cache`.

Requires an OpenTopography API key. Register free at:
    https://portal.opentopography.org/requestService?service=api

Set via env var `OPENTOPOGRAPHY_API_KEY` or pass explicitly to the client.
"""
from __future__ import annotations

import math
import os
import urllib.parse
from typing import Optional

import httpx

OPENTOPO_BASE_URL = "https://portal.opentopography.org/API/globaldem"
DEFAULT_DEM_TYPE = "COP30"  # Copernicus DEM GLO-30, 30m global
DEFAULT_TIMEOUT_S = 60.0
METERS_PER_DEG_LAT = 111_000.0


class OpenTopoError(RuntimeError):
    """Raised when an OpenTopography request fails or is misconfigured."""


def bbox_for_radius_km(*, lat: float, lng: float, radius_km: float) -> tuple[float, float, float, float]:
    """Return `(south, north, west, east)` bounds of a square around (lat, lng).

    Longitude width is compensated by `cos(lat)` so the box remains roughly
    square on the ground at all latitudes except the poles.
    """
    half_lat = radius_km * 1000 / METERS_PER_DEG_LAT
    cos_lat = max(math.cos(math.radians(lat)), 1e-6)
    half_lng = half_lat / cos_lat
    return (lat - half_lat, lat + half_lat, lng - half_lng, lng + half_lng)


def opentopo_url(
    *,
    south: float,
    north: float,
    west: float,
    east: float,
    api_key: str,
    dem_type: str = DEFAULT_DEM_TYPE,
    base_url: str = OPENTOPO_BASE_URL,
) -> str:
    """Build an OpenTopography globaldem URL."""
    params = {
        "demtype": dem_type,
        "south": south,
        "north": north,
        "west": west,
        "east": east,
        "outputFormat": "GTiff",
        "API_Key": api_key,
    }
    return f"{base_url}?{urllib.parse.urlencode(params)}"


class OpenTopoClient:
    """Fetches Copernicus DEM GLO-30 GeoTIFFs from OpenTopography."""

    def __init__(
        self,
        *,
        api_key: Optional[str] = None,
        base_url: str = OPENTOPO_BASE_URL,
        dem_type: str = DEFAULT_DEM_TYPE,
        timeout_s: float = DEFAULT_TIMEOUT_S,
        transport: Optional[httpx.BaseTransport] = None,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url
        self._dem_type = dem_type
        self._client = httpx.Client(timeout=timeout_s, transport=transport)

    def _resolve_api_key(self) -> str:
        key = self._api_key or os.environ.get("OPENTOPOGRAPHY_API_KEY")
        if not key:
            raise OpenTopoError(
                "OpenTopography API key not set. Register a free key at "
                "https://portal.opentopography.org/ and set OPENTOPOGRAPHY_API_KEY."
            )
        return key

    def fetch(self, *, lat: float, lng: float, radius_km: float = 50) -> bytes:
        """Return raw GeoTIFF bytes for a bbox of half-width `radius_km` around (lat, lng)."""
        south, north, west, east = bbox_for_radius_km(lat=lat, lng=lng, radius_km=radius_km)
        url = opentopo_url(
            south=south,
            north=north,
            west=west,
            east=east,
            api_key=self._resolve_api_key(),
            dem_type=self._dem_type,
            base_url=self._base_url,
        )
        try:
            response = self._client.get(url)
        except httpx.HTTPError as exc:
            raise OpenTopoError(f"network error: {exc}") from exc
        if response.status_code != 200:
            raise OpenTopoError(
                f"HTTP {response.status_code} from OpenTopography: {response.text[:200]}"
            )
        return response.content

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self._client.close()

    def __enter__(self) -> "OpenTopoClient":
        """Enter context manager."""
        return self

    def __exit__(self, *exc_info) -> None:
        """Exit context manager and close the client."""
        self.close()
