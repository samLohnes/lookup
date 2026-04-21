"""Horizon mask computation from a DEM.

Casts 360 rays at 1° azimuth increments outward from the observer, samples
the DEM along each ray, and records the maximum elevation angle seen. The
result is a 360-element `HorizonMask`, usable by `predict_passes` to filter
terrain-blocked passes.
"""
from __future__ import annotations

import math

import numpy as np

from core._types import DEM, HorizonMask, Observer

_METERS_PER_DEG_LAT = 111_000.0
_RAY_STEP_M = 100.0
_MAX_RAY_DISTANCE_M = 50_000.0


def _sample_dem_at(dem: DEM, lat: float, lng: float) -> float:
    """Bilinear-ish sample of the DEM at (lat, lng). Returns NaN if outside bounds."""
    elevations: np.ndarray = dem.elevations  # type: ignore[assignment]
    rows, cols = elevations.shape
    if not (dem.south_lat <= lat <= dem.north_lat):
        return float("nan")
    if not (dem.west_lng <= lng <= dem.east_lng):
        return float("nan")

    # Normalise to fractional row/col; row 0 = north.
    lat_frac = (dem.north_lat - lat) / max(dem.north_lat - dem.south_lat, 1e-9)
    lng_frac = (lng - dem.west_lng) / max(dem.east_lng - dem.west_lng, 1e-9)

    r = lat_frac * (rows - 1)
    c = lng_frac * (cols - 1)

    r0 = int(math.floor(r))
    c0 = int(math.floor(c))
    r1 = min(r0 + 1, rows - 1)
    c1 = min(c0 + 1, cols - 1)
    dr = r - r0
    dc = c - c0

    v = (
        elevations[r0, c0] * (1 - dr) * (1 - dc)
        + elevations[r1, c0] * dr * (1 - dc)
        + elevations[r0, c1] * (1 - dr) * dc
        + elevations[r1, c1] * dr * dc
    )
    return float(v)


def compute_horizon_mask(
    *,
    dem: DEM,
    observer: Observer,
    samples: int = 360,
    ray_step_m: float = _RAY_STEP_M,
    max_distance_m: float = _MAX_RAY_DISTANCE_M,
) -> HorizonMask:
    """Compute a 360-element horizon mask from a DEM and observer location.

    Args:
        dem: Elevation tile covering the area around `observer`.
        observer: Observation location. `observer.elevation_m` is used as
            the observer's physical eye height; terrain at the observer
            is NOT auto-added.
        samples: Number of azimuths. Must be 360 for `HorizonMask`.
        ray_step_m: Distance between samples along each ray.
        max_distance_m: How far to cast each ray.

    Returns:
        `HorizonMask` with one min-elevation-degree value per azimuth (0..359).
    """
    if samples != 360:
        raise ValueError("HorizonMask currently requires exactly 360 samples")

    lat0 = observer.lat
    lng0 = observer.lng
    h0 = observer.elevation_m
    cos_lat = max(math.cos(math.radians(lat0)), 1e-6)

    horizon = np.full(samples, -90.0, dtype=np.float64)

    distances = np.arange(ray_step_m, max_distance_m + ray_step_m, ray_step_m, dtype=np.float64)

    for az_deg in range(samples):
        az_rad = math.radians(az_deg)
        # Ray direction in degrees-per-meter.
        d_lat_per_m = math.cos(az_rad) / _METERS_PER_DEG_LAT
        d_lng_per_m = math.sin(az_rad) / (_METERS_PER_DEG_LAT * cos_lat)

        max_angle = -90.0
        for d in distances:
            lat_s = lat0 + d_lat_per_m * d
            lng_s = lng0 + d_lng_per_m * d
            h_s = _sample_dem_at(dem, lat_s, lng_s)
            if math.isnan(h_s):
                break
            # Elevation angle from observer to this surface point.
            angle = math.degrees(math.atan2(h_s - h0, d))
            if angle > max_angle:
                max_angle = angle
        horizon[az_deg] = max_angle

    return HorizonMask(samples_deg=tuple(float(v) for v in horizon))
