"""Tests for core.terrain.dem_cache."""
from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest

from core._types import DEM
from core.terrain.dem_cache import DEMCache, dem_cache_key


def test_cache_key_is_stable():
    a = dem_cache_key(lat=40.7128, lng=-74.0060, radius_km=50)
    b = dem_cache_key(lat=40.7128, lng=-74.0060, radius_km=50)
    assert a == b


def test_cache_key_differs_for_different_locations():
    a = dem_cache_key(lat=40.7128, lng=-74.0060, radius_km=50)
    b = dem_cache_key(lat=51.5, lng=-0.12, radius_km=50)
    assert a != b


def test_save_and_load_roundtrip(tmp_path: Path, synth_dem_tile_bytes: bytes):
    cache = DEMCache(root=tmp_path)

    key = dem_cache_key(lat=0.0, lng=0.0, radius_km=1)
    cache.save_bytes(key, synth_dem_tile_bytes)

    loaded = cache.load(key)
    assert loaded is not None
    assert isinstance(loaded, DEM)
    assert loaded.shape == (3, 3)
    assert loaded.elevations[1, 1] == pytest.approx(120.0)


def test_cache_miss_returns_none(tmp_path: Path):
    cache = DEMCache(root=tmp_path)
    assert cache.load(dem_cache_key(lat=0.0, lng=0.0, radius_km=5)) is None
