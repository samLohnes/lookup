"""Schema-level validation tests for api.schemas.requests."""
from __future__ import annotations

import pytest
from pydantic import ValidationError

from api.schemas.requests import NowPositionsRequest, NowTracksRequest


def test_now_positions_request_minimal():
    req = NowPositionsRequest(lat=40.0, lng=-74.0, norad_ids=[25544])
    assert req.norad_ids == [25544]
    assert req.elevation_m == 0.0


def test_now_positions_request_rejects_empty_norad_ids():
    with pytest.raises(ValidationError):
        NowPositionsRequest(lat=40.0, lng=-74.0, norad_ids=[])


def test_now_tracks_request_defaults():
    req = NowTracksRequest(lat=40.0, lng=-74.0, norad_ids=[25544])
    assert req.tail_minutes == 10
    assert req.dt_seconds == 30


def test_now_tracks_request_validates_tail_minutes_bounds():
    with pytest.raises(ValidationError):
        NowTracksRequest(lat=40.0, lng=-74.0, norad_ids=[25544], tail_minutes=0)
    with pytest.raises(ValidationError):
        NowTracksRequest(lat=40.0, lng=-74.0, norad_ids=[25544], tail_minutes=61)


def test_now_tracks_request_validates_dt_seconds_bounds():
    with pytest.raises(ValidationError):
        NowTracksRequest(lat=40.0, lng=-74.0, norad_ids=[25544], dt_seconds=0)
    with pytest.raises(ValidationError):
        NowTracksRequest(lat=40.0, lng=-74.0, norad_ids=[25544], dt_seconds=301)
