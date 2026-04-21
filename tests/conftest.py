"""Shared pytest fixtures for the engine tests.

Loads skyfield's timescale and DE421 planetary ephemeris once per session.
DE421 is cached at tests/fixtures/skyfield_cache/ so it's downloaded once, not once per run.
"""
from __future__ import annotations

from pathlib import Path

import pytest
from skyfield.api import Loader


_CACHE_DIR = Path(__file__).resolve().parent / "fixtures" / "skyfield_cache"


@pytest.fixture(scope="session")
def skyfield_loader() -> Loader:
    """A skyfield Loader that caches downloads under tests/fixtures/skyfield_cache."""
    _CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return Loader(str(_CACHE_DIR))


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
