"""Tests for core.orbital.refraction constants."""
from __future__ import annotations

from core.orbital.refraction import (
    HORIZON_REFRACTION_DEG,
    STANDARD_PRESSURE_MBAR,
    STANDARD_TEMPERATURE_C,
)


def test_horizon_refraction_is_iau_value():
    """Horizon refraction is ~34 arc-minutes (IAU/USNO convention)."""
    # 34 arc-minutes = 0.5667 degrees, give or take 1 arcsec.
    assert 0.55 < HORIZON_REFRACTION_DEG < 0.58


def test_standard_pressure_is_sea_level():
    """Sea-level pressure for refraction model: 1010 mbar."""
    assert 1000 <= STANDARD_PRESSURE_MBAR <= 1020


def test_standard_temperature_is_temperate():
    """Standard temperature: 10°C — temperate-zone average."""
    assert 0 <= STANDARD_TEMPERATURE_C <= 20
