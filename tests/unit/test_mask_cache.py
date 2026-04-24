"""Tests for core.terrain.mask_cache."""
from __future__ import annotations

from pathlib import Path

from core._types import HorizonMask
from core.terrain.mask_cache import HorizonMaskCache, mask_cache_key


def test_mask_key_stable():
    assert (
        mask_cache_key(lat=40.7128, lng=-74.0060, radius_km=50, elevation_m=10)
        == mask_cache_key(lat=40.7128, lng=-74.0060, radius_km=50, elevation_m=10)
    )


def test_mask_key_differs_by_elevation():
    """A mountain summit sees a very different horizon than its base —
    the cache must not conflate them. See `mask_cache_key` docstring."""
    sea_level = mask_cache_key(lat=19.82, lng=-155.47, radius_km=50, elevation_m=0)
    summit = mask_cache_key(lat=19.82, lng=-155.47, radius_km=50, elevation_m=4205)
    assert sea_level != summit


def test_mask_cache_roundtrip(tmp_path: Path):
    cache = HorizonMaskCache(root=tmp_path)
    samples = tuple(float(i % 10) for i in range(360))
    mask = HorizonMask(samples_deg=samples)

    key = mask_cache_key(lat=0.0, lng=0.0, radius_km=50, elevation_m=0)
    cache.save(key, mask)

    loaded = cache.load(key)
    assert loaded is not None
    assert loaded.samples_deg == samples


def test_mask_cache_miss(tmp_path: Path):
    cache = HorizonMaskCache(root=tmp_path)
    assert (
        cache.load(mask_cache_key(lat=1.0, lng=1.0, radius_km=50, elevation_m=0))
        is None
    )
