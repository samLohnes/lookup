"""Tests for core.types — the dataclasses used across the engine."""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from core._types import (
    AngularPosition,
    CatalogHit,
    Observer,
    Pass,
    PassEndpoint,
    Resolution,
    TLE,
    TrackSample,
    VisibilityMode,
)


def test_observer_construction():
    o = Observer(lat=40.7128, lng=-74.0060, elevation_m=10.0, name="Brooklyn")
    assert o.lat == 40.7128
    assert o.lng == -74.0060
    assert o.elevation_m == 10.0
    assert o.name == "Brooklyn"


def test_observer_name_optional():
    o = Observer(lat=0.0, lng=0.0, elevation_m=0.0)
    assert o.name is None


def test_observer_is_frozen():
    o = Observer(lat=0.0, lng=0.0, elevation_m=0.0)
    with pytest.raises(Exception):  # FrozenInstanceError
        o.lat = 1.0  # type: ignore[misc]


def test_tle_construction():
    epoch = datetime(2026, 4, 19, 12, 0, 0, tzinfo=timezone.utc)
    tle = TLE(
        norad_id=25544,
        name="ISS (ZARYA)",
        line1="1 25544U 98067A   26109.50000000  .00000000  00000-0  00000-0 0  9990",
        line2="2 25544  51.6400   0.0000 0000000   0.0000   0.0000 15.50000000    00",
        epoch=epoch,
    )
    assert tle.norad_id == 25544
    assert tle.name == "ISS (ZARYA)"
    assert tle.epoch == epoch


def test_angular_position():
    p = AngularPosition(azimuth_deg=247.3, elevation_deg=52.1)
    assert p.azimuth_deg == 247.3
    assert p.elevation_deg == 52.1


def test_pass_construction():
    t0 = datetime(2026, 4, 22, 1, 47, 8, tzinfo=timezone.utc)
    t1 = datetime(2026, 4, 22, 1, 49, 14, tzinfo=timezone.utc)
    t2 = datetime(2026, 4, 22, 1, 51, 20, tzinfo=timezone.utc)
    p = Pass(
        id="25544-2026042201470800",
        norad_id=25544,
        name="ISS (ZARYA)",
        rise=PassEndpoint(time=t0, position=AngularPosition(347.0, 12.0)),
        peak=PassEndpoint(time=t1, position=AngularPosition(247.3, 52.1)),
        set=PassEndpoint(time=t2, position=AngularPosition(137.0, 10.0)),
        duration_s=252,
        max_magnitude=-2.8,
        sunlit_fraction=1.0,
        tle_epoch=datetime(2026, 4, 19, 12, 0, 0, tzinfo=timezone.utc),
        terrain_blocked_ranges=(),
    )
    assert p.duration_s == 252
    assert p.peak.position.elevation_deg == 52.1
    assert p.terrain_blocked_ranges == ()


def test_track_sample():
    s = TrackSample(
        time=datetime(2026, 4, 22, 1, 49, 14, tzinfo=timezone.utc),
        lat=40.7,
        lng=-74.0,
        alt_km=408.2,
        az=247.3,
        el=52.1,
        range_km=514.0,
        velocity_km_s=7.66,
        magnitude=-2.8,
        sunlit=True,
        observer_dark=True,
    )
    assert s.range_km == 514.0
    assert s.sunlit is True


def test_visibility_mode_values():
    # Ensure the Literal is spelled correctly
    def _accepts(m: VisibilityMode) -> VisibilityMode:
        return m
    assert _accepts("line-of-sight") == "line-of-sight"
    assert _accepts("naked-eye") == "naked-eye"


def test_catalog_hit():
    h = CatalogHit(
        display_name="ISS (ZARYA)",
        match_type="satellite",
        norad_ids=(25544,),
        score=100.0,
    )
    assert h.norad_ids == (25544,)


def test_resolution_single_and_group():
    single = Resolution(type="single", norad_ids=(25544,), display_name="ISS (ZARYA)")
    group = Resolution(type="group", norad_ids=(44713, 44714, 44715), display_name="starlink")
    assert single.type == "single"
    assert group.type == "group"
    assert len(group.norad_ids) == 3


# --- M2 additions below ---

import numpy as np

from core._types import DEM, TrainPass


def test_train_pass_construction():
    t0 = datetime(2026, 5, 1, 2, 0, 0, tzinfo=timezone.utc)
    t1 = datetime(2026, 5, 1, 2, 2, 30, tzinfo=timezone.utc)
    t2 = datetime(2026, 5, 1, 2, 5, 0, tzinfo=timezone.utc)

    members = (
        Pass(
            id="44713-20260501020000",
            norad_id=44713,
            name="STARLINK-1",
            rise=PassEndpoint(time=t0, position=AngularPosition(10.0, 10.0)),
            peak=PassEndpoint(time=t1, position=AngularPosition(180.0, 60.0)),
            set=PassEndpoint(time=t2, position=AngularPosition(350.0, 10.0)),
            duration_s=300,
            max_magnitude=4.0,
            sunlit_fraction=1.0,
            tle_epoch=t0,
            terrain_blocked_ranges=(),
        ),
    )

    tp = TrainPass(
        id="starlink-train-20260501020000",
        name="Starlink-L175 train",
        member_norad_ids=(44713, 44714, 44715),
        rise=PassEndpoint(time=t0, position=AngularPosition(10.0, 10.0)),
        peak=PassEndpoint(time=t1, position=AngularPosition(180.0, 60.0)),
        set=PassEndpoint(time=t2, position=AngularPosition(350.0, 10.0)),
        duration_s=300,
        max_magnitude=4.0,
        member_passes=members,
    )

    assert tp.name == "Starlink-L175 train"
    assert tp.member_norad_ids == (44713, 44714, 44715)
    assert tp.peak.position.elevation_deg == 60.0
    assert tp.member_passes == members


def test_dem_construction_and_sampling():
    # 3×3 synthetic grid at (0°, 0°) with 1 m spacing per sample.
    elevations = np.array(
        [[100.0, 110.0, 120.0],
         [105.0, 115.0, 125.0],
         [108.0, 118.0, 128.0]],
        dtype=np.float32,
    )
    dem = DEM(
        south_lat=0.0,
        north_lat=1e-5,
        west_lng=0.0,
        east_lng=1e-5,
        elevations=elevations,
    )
    assert dem.shape == (3, 3)
    assert dem.elevations[1, 1] == 115.0
