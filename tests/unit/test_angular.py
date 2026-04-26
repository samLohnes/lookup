"""Tests for core.orbital.angular — great-circle angular distance on the sky."""
from __future__ import annotations

import math

import pytest

from core.orbital.angular import angular_distance_deg


def test_zero_distance():
    """Same point: 0°."""
    assert angular_distance_deg(45.0, 30.0, 45.0, 30.0) == pytest.approx(0.0, abs=1e-9)


def test_ninety_degree_separation_horizontal():
    """Two points 90° apart in azimuth at the equator (el=0): 90°."""
    d = angular_distance_deg(0.0, 0.0, 90.0, 0.0)
    assert d == pytest.approx(90.0, abs=1e-6)


def test_zenith_az_invariant():
    """Near zenith, az difference shrinks: (az=0, el=89) and (az=180, el=89)
    are 2° apart on the sky, NOT 180°."""
    d = angular_distance_deg(0.0, 89.0, 180.0, 89.0)
    assert d == pytest.approx(2.0, abs=1e-3)


def test_small_separation():
    """A 1° az step at el=0 is a 1° great-circle separation."""
    d = angular_distance_deg(180.0, 0.0, 181.0, 0.0)
    assert d == pytest.approx(1.0, abs=1e-3)


def test_az_wrap():
    """Azimuth wraps: (359, 10) and (1, 10) are 2° apart, not 358°."""
    d = angular_distance_deg(359.0, 10.0, 1.0, 10.0)
    # cos(distance) ≈ cos²(10°) cos(2°) + sin²(10°)
    expected = math.degrees(
        math.acos(
            math.cos(math.radians(10)) ** 2 * math.cos(math.radians(2))
            + math.sin(math.radians(10)) ** 2
        )
    )
    assert d == pytest.approx(expected, abs=1e-3)
