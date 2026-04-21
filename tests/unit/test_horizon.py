"""Tests for core.terrain.horizon."""
from __future__ import annotations

import numpy as np
import pytest

from core._types import DEM, HorizonMask, Observer
from core.terrain.horizon import compute_horizon_mask


def _flat_dem(height_m: float = 100.0, size: int = 21) -> DEM:
    """A flat plain at constant elevation, 1km square, centered at (0,0)."""
    elevations = np.full((size, size), height_m, dtype=np.float32)
    half = 0.005  # ~500m in degrees
    return DEM(south_lat=-half, north_lat=half, west_lng=-half, east_lng=half,
               elevations=elevations)


def _cone_dem(peak_m: float = 500.0, base_m: float = 100.0, size: int = 41) -> DEM:
    """A cone with peak at grid center, falling linearly to `base_m` at the corners."""
    cx, cy = size // 2, size // 2
    ys, xs = np.mgrid[0:size, 0:size]
    dist = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    max_dist = dist.max()
    slope = (peak_m - base_m) / max_dist
    elevations = (peak_m - slope * dist).astype(np.float32)
    half = 0.005
    return DEM(south_lat=-half, north_lat=half, west_lng=-half, east_lng=half,
               elevations=elevations)


def test_flat_terrain_gives_zero_horizon():
    dem = _flat_dem(height_m=100.0)
    observer = Observer(lat=0.0, lng=0.0, elevation_m=100.0)  # same height as terrain

    mask = compute_horizon_mask(dem=dem, observer=observer)

    assert isinstance(mask, HorizonMask)
    assert len(mask.samples_deg) == 360
    # Flat at observer height -> horizon elevation ~0° everywhere.
    samples = np.asarray(mask.samples_deg)
    assert np.all(samples < 0.1)


def test_cone_terrain_puts_high_horizon_near_the_peak():
    dem = _cone_dem(peak_m=500.0)
    # Observer sits at the SW edge of the tile, at base elevation.
    observer = Observer(lat=-0.004, lng=-0.004, elevation_m=100.0)

    mask = compute_horizon_mask(dem=dem, observer=observer)

    # Peak is to the NE of observer — azimuth ~45° — should be the maximum.
    samples = np.asarray(mask.samples_deg)
    peak_az = int(np.argmax(samples))
    assert 20 <= peak_az <= 70
    # And the peak horizon elevation should be substantial (cone rises 400m over ~600m).
    assert samples[peak_az] > 10.0


def test_observer_above_terrain_gives_negative_horizon():
    dem = _flat_dem(height_m=100.0)
    # Observer 500m above the plain — should see a negative horizon elevation
    # in the azimuth directions where the DEM surface drops below them.
    observer = Observer(lat=0.0, lng=0.0, elevation_m=600.0)

    mask = compute_horizon_mask(dem=dem, observer=observer)

    samples = np.asarray(mask.samples_deg)
    # At least some samples should be < 0.
    assert np.any(samples < 0.0)


def test_mask_has_exactly_360_samples():
    dem = _flat_dem()
    observer = Observer(lat=0.0, lng=0.0, elevation_m=100.0)
    mask = compute_horizon_mask(dem=dem, observer=observer)
    assert len(mask.samples_deg) == 360
