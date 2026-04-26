"""New PassResponse fields: range_km on each endpoint, peak_angular_speed_deg_s,
naked_eye_visible at the top level."""
from __future__ import annotations

from datetime import datetime, timezone

from core._types import (
    AngularPosition,
    Pass,
    PassEndpoint,
    TrainPass,
)
from api.schemas.responses import pass_to_response, trainpass_to_response


def _sample_pass(naked_eye_visible="yes") -> Pass:
    pos = AngularPosition(azimuth_deg=180.0, elevation_deg=45.0)
    ep = PassEndpoint(time=datetime(2026, 1, 1, tzinfo=timezone.utc), position=pos, range_km=600.0)
    return Pass(
        id="x",
        norad_id=25544,
        name="ISS",
        rise=ep, peak=ep, set=ep,
        duration_s=600,
        max_magnitude=-2.0,
        sunlit_fraction=0.7,
        tle_epoch=datetime(2026, 1, 1, tzinfo=timezone.utc),
        peak_angular_speed_deg_s=0.74,
        naked_eye_visible=naked_eye_visible,
    )


def test_pass_to_response_includes_range_km():
    r = pass_to_response(_sample_pass())
    assert r.rise.range_km == 600.0
    assert r.peak.range_km == 600.0
    assert r.set.range_km == 600.0


def test_pass_to_response_includes_peak_angular_speed():
    r = pass_to_response(_sample_pass())
    assert r.peak_angular_speed_deg_s == 0.74


def test_pass_to_response_includes_naked_eye_visible():
    r = pass_to_response(_sample_pass())
    assert r.naked_eye_visible == "yes"


def test_pass_to_response_naked_eye_can_be_none():
    r = pass_to_response(_sample_pass(naked_eye_visible=None))
    assert r.naked_eye_visible is None


def test_trainpass_to_response_propagates_range_km_from_endpoints():
    """`PassEndpointResponse.range_km` is required by the Pydantic schema —
    the train converter must pass it through from each member endpoint, or
    the API will 500 in production. This test guards that wiring."""
    members = (_sample_pass(naked_eye_visible=None),)
    pos = AngularPosition(azimuth_deg=180.0, elevation_deg=45.0)
    rise_ep = PassEndpoint(
        time=datetime(2026, 1, 1, tzinfo=timezone.utc), position=pos, range_km=1800.0,
    )
    peak_ep = PassEndpoint(
        time=datetime(2026, 1, 1, tzinfo=timezone.utc), position=pos, range_km=540.0,
    )
    set_ep = PassEndpoint(
        time=datetime(2026, 1, 1, tzinfo=timezone.utc), position=pos, range_km=1900.0,
    )
    tp = TrainPass(
        id="train-x",
        name="STARLINK train (1 objects)",
        member_norad_ids=(25544,),
        rise=rise_ep, peak=peak_ep, set=set_ep,
        duration_s=600,
        max_magnitude=-2.0,
        member_passes=members,
    )
    r = trainpass_to_response(tp)
    assert r.kind == "train"
    assert r.rise.range_km == 1800.0
    assert r.peak.range_km == 540.0
    assert r.set.range_km == 1900.0
    assert r.member_count == 1
