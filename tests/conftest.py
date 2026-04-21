"""Shared pytest fixtures for the engine tests.

Loads skyfield's timescale and DE421 planetary ephemeris once per session.
DE421 is downloaded on first use to the local pytest cache dir.
"""
from __future__ import annotations

from pathlib import Path

import pytest
from skyfield.api import Loader


@pytest.fixture(scope="session")
def skyfield_loader(tmp_path_factory: pytest.TempPathFactory) -> Loader:
    """A skyfield Loader that caches downloads in a pytest tmp dir."""
    cache = tmp_path_factory.mktemp("skyfield-cache")
    return Loader(str(cache))


@pytest.fixture(scope="session")
def timescale(skyfield_loader: Loader):
    """Skyfield Timescale — expensive; shared across the whole session."""
    return skyfield_loader.timescale()


@pytest.fixture(scope="session")
def ephemeris(skyfield_loader: Loader):
    """DE421 planetary ephemeris — downloaded once, reused."""
    return skyfield_loader("de421.bsp")


@pytest.fixture
def iss_tle_path() -> Path:
    """Path to the committed ISS TLE fixture."""
    return Path(__file__).resolve().parent / "fixtures" / "tle" / "iss_25544.txt"
