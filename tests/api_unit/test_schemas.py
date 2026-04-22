"""Tests for api.schemas — round-tripping engine types through Pydantic."""
from __future__ import annotations

from datetime import datetime, timezone

from core._types import AngularPosition, Pass, PassEndpoint
from api.schemas.requests import PassesRequest, SkyTrackRequest
from api.schemas.responses import PassResponse, pass_to_response


def test_passes_request_parses_strings():
    body = {
        "lat": 40.7128,
        "lng": -74.0060,
        "elevation_m": 10,
        "query": "ISS",
        "from_utc": "2026-05-01T00:00:00Z",
        "to_utc": "2026-05-08T00:00:00Z",
        "mode": "naked-eye",
    }
    req = PassesRequest.model_validate(body)
    assert req.lat == 40.7128
    assert req.mode == "naked-eye"


def test_passes_request_rejects_bad_mode():
    import pydantic

    bad = {
        "lat": 0.0, "lng": 0.0, "elevation_m": 0, "query": "iss",
        "from_utc": "2026-05-01T00:00:00Z", "to_utc": "2026-05-08T00:00:00Z",
        "mode": "invalid",
    }
    try:
        PassesRequest.model_validate(bad)
        raise AssertionError("expected validation error")
    except pydantic.ValidationError:
        pass


def test_pass_to_response_roundtrip():
    t0 = datetime(2026, 5, 1, 2, 0, 0, tzinfo=timezone.utc)
    p = Pass(
        id="25544-20260501020000",
        norad_id=25544,
        name="ISS (ZARYA)",
        rise=PassEndpoint(time=t0, position=AngularPosition(30.0, 10.0)),
        peak=PassEndpoint(time=t0, position=AngularPosition(180.0, 60.0)),
        set=PassEndpoint(time=t0, position=AngularPosition(300.0, 10.0)),
        duration_s=300,
        max_magnitude=-2.5,
        sunlit_fraction=0.9,
        tle_epoch=t0,
        terrain_blocked_ranges=(),
    )
    resp = pass_to_response(p)
    assert isinstance(resp, PassResponse)
    assert resp.id == p.id
    assert resp.peak.elevation_deg == 60.0
    data = resp.model_dump()
    assert data["max_magnitude"] == -2.5


def test_sky_track_request_validates():
    body = {
        "lat": 40.7128, "lng": -74.0060, "elevation_m": 10,
        "query": "ISS",
        "from_utc": "2026-05-01T00:00:00Z",
        "to_utc": "2026-05-01T00:05:00Z",
        "dt_seconds": 5,
    }
    req = SkyTrackRequest.model_validate(body)
    assert req.dt_seconds == 5
