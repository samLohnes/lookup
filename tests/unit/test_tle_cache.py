"""Tests for core.catalog.tle_cache."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from core._types import TLE
from core.catalog.tle_cache import TLECache


def _make_tle(norad_id: int = 25544) -> TLE:
    return TLE(
        norad_id=norad_id,
        name="ISS (ZARYA)",
        line1="1 25544U 98067A   26110.78039753  .00010000  00000-0  18000-3 0  9990",
        line2="2 25544  51.6406 224.2064 0006726 330.9385  29.0851 15.50000000 99990",
        epoch=datetime(2026, 4, 20, 18, 43, 46, tzinfo=timezone.utc),
    )


def test_cache_miss_returns_none(tmp_path: Path):
    cache = TLECache(root=tmp_path)
    assert cache.load_single(25544) is None


def test_cache_roundtrip_single(tmp_path: Path):
    cache = TLECache(root=tmp_path)
    tle = _make_tle()
    fetched_at = datetime(2026, 4, 20, 19, 0, 0, tzinfo=timezone.utc)

    cache.save_single(tle, fetched_at=fetched_at)

    loaded, loaded_at = cache.load_single(25544)  # type: ignore[misc]
    assert loaded.norad_id == tle.norad_id
    assert loaded.line1 == tle.line1
    assert loaded.line2 == tle.line2
    assert loaded.epoch == tle.epoch
    assert loaded_at == fetched_at


def test_cache_roundtrip_group(tmp_path: Path):
    cache = TLECache(root=tmp_path)
    tles = [_make_tle(25544), _make_tle(48274)]
    fetched_at = datetime(2026, 4, 20, 19, 0, 0, tzinfo=timezone.utc)

    cache.save_group("stations", tles, fetched_at=fetched_at)

    loaded, loaded_at = cache.load_group("stations")  # type: ignore[misc]
    assert len(loaded) == 2
    assert loaded_at == fetched_at


def test_cache_age_seconds(tmp_path: Path):
    cache = TLECache(root=tmp_path)
    tle = _make_tle()
    fetched_at = datetime(2026, 4, 20, 10, 0, 0, tzinfo=timezone.utc)
    cache.save_single(tle, fetched_at=fetched_at)

    now = fetched_at + timedelta(hours=3)
    loaded, loaded_at = cache.load_single(25544)  # type: ignore[misc]
    age = (now - loaded_at).total_seconds()
    assert age == pytest.approx(10800.0)
