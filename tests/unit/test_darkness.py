"""Tests for core.visibility.darkness."""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from core._types import Observer
from core.visibility.darkness import (
    ASTRONOMICAL_TWILIGHT_DEG,
    CIVIL_TWILIGHT_DEG,
    NAUTICAL_TWILIGHT_DEG,
    is_observer_in_darkness,
)

# NYC on 2024-06-21 (summer solstice). Sunrise ~5:25 EDT (09:25 UTC),
# sunset ~20:30 EDT (00:30 UTC next day).
NYC = Observer(lat=40.7128, lng=-74.0060, elevation_m=10.0, name="NYC")


def test_local_noon_is_not_dark(timescale, ephemeris):
    t_noon = datetime(2024, 6, 21, 16, 0, 0, tzinfo=timezone.utc)  # 12:00 EDT
    assert is_observer_in_darkness(t_noon, NYC, timescale, ephemeris) is False


def test_local_midnight_is_dark(timescale, ephemeris):
    t_midnight = datetime(2024, 6, 22, 4, 0, 0, tzinfo=timezone.utc)  # 00:00 EDT
    assert is_observer_in_darkness(t_midnight, NYC, timescale, ephemeris) is True


def test_civil_twilight_threshold_default(timescale, ephemeris):
    """Default threshold is civil twilight (-6°)."""
    # Dusk on 2024-06-21 NYC — just after civil twilight starts
    t = datetime(2024, 6, 22, 1, 40, 0, tzinfo=timezone.utc)  # ~21:40 EDT
    # At this moment sun should be below -6° → dark
    assert is_observer_in_darkness(t, NYC, timescale, ephemeris) is True


def test_astronomical_threshold_is_stricter(timescale, ephemeris):
    """A moment could be 'dark' by civil but not by astronomical definition."""
    # Time when sun is about -9° at NYC — dark by civil, not by astronomical
    t = datetime(2024, 6, 22, 1, 20, 0, tzinfo=timezone.utc)  # ~21:20 EDT
    # civil (-6°): should be dark
    assert is_observer_in_darkness(t, NYC, timescale, ephemeris, threshold_deg=CIVIL_TWILIGHT_DEG) is True
    # astronomical (-18°): not yet dark
    assert is_observer_in_darkness(t, NYC, timescale, ephemeris, threshold_deg=ASTRONOMICAL_TWILIGHT_DEG) is False


def test_threshold_constants():
    assert CIVIL_TWILIGHT_DEG == -6.0
    assert NAUTICAL_TWILIGHT_DEG == -12.0
    assert ASTRONOMICAL_TWILIGHT_DEG == -18.0
