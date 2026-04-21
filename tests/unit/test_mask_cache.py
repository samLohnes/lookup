"""Tests for core.terrain.mask_cache."""
from __future__ import annotations

from pathlib import Path

from core._types import HorizonMask
from core.terrain.mask_cache import HorizonMaskCache, mask_cache_key


def test_mask_key_stable():
    assert (
        mask_cache_key(lat=40.7128, lng=-74.0060, radius_km=50)
        == mask_cache_key(lat=40.7128, lng=-74.0060, radius_km=50)
    )


def test_mask_cache_roundtrip(tmp_path: Path):
    cache = HorizonMaskCache(root=tmp_path)
    samples = tuple(float(i % 10) for i in range(360))
    mask = HorizonMask(samples_deg=samples)

    key = mask_cache_key(lat=0.0, lng=0.0, radius_km=50)
    cache.save(key, mask)

    loaded = cache.load(key)
    assert loaded is not None
    assert loaded.samples_deg == samples


def test_mask_cache_miss(tmp_path: Path):
    cache = HorizonMaskCache(root=tmp_path)
    assert cache.load(mask_cache_key(lat=1.0, lng=1.0, radius_km=50)) is None
