"""Shared pytest fixtures for the engine tests.

Loads skyfield's timescale and DE421 planetary ephemeris once per session.
DE421 is cached at tests/fixtures/skyfield_cache/ so it's downloaded once, not once per run.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
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


# --- M2 additions below ---


@pytest.fixture(scope="session")
def synth_dem_tile_bytes(tmp_path_factory: pytest.TempPathFactory):
    """Generate a tiny synthetic GeoTIFF for DEM tests.

    3x3 grid centered at (0°, 0°), cell size 1e-5°, elevations form a cone
    peaking at the center (100 m → 120 m going outward).
    """
    rasterio = pytest.importorskip("rasterio")
    from rasterio.transform import from_bounds

    tmp = tmp_path_factory.mktemp("synth-dem")
    path = tmp / "synth.tif"

    data = np.array(
        [[100.0, 110.0, 100.0],
         [110.0, 120.0, 110.0],
         [100.0, 110.0, 100.0]],
        dtype=np.float32,
    )
    transform = from_bounds(west=-1e-5, south=-1e-5, east=1e-5, north=1e-5,
                            width=3, height=3)
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        height=3,
        width=3,
        count=1,
        dtype="float32",
        crs="EPSG:4326",
        transform=transform,
    ) as dst:
        dst.write(data, 1)
    return path.read_bytes()
