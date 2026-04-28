"""Schema construction tests for /now-positions and /now-tracks responses."""
from __future__ import annotations

from datetime import datetime, timezone

from api.schemas.responses import (
    NowPositionEntry,
    NowPositionsResponse,
    NowTrackEntry,
    NowTracksResponse,
    TrackSampleResponse,
)


def _sample(t: datetime) -> TrackSampleResponse:
    return TrackSampleResponse(
        time=t, lat=40.0, lng=-74.0, alt_km=412.0,
        az=142.0, el=56.0, range_km=478.0,
        velocity_km_s=7.68, magnitude=-2.1,
        sunlit=True, observer_dark=True,
    )


def test_now_positions_response_serializes():
    t = datetime(2026, 4, 27, 3, 25, 0, tzinfo=timezone.utc)
    res = NowPositionsResponse(
        entries=[NowPositionEntry(norad_id=25544, sample=_sample(t))],
    )
    body = res.model_dump(mode="json")
    assert body["entries"][0]["norad_id"] == 25544
    assert body["entries"][0]["sample"]["alt_km"] == 412.0


def test_now_tracks_response_serializes():
    t = datetime(2026, 4, 27, 3, 25, 0, tzinfo=timezone.utc)
    res = NowTracksResponse(
        entries=[NowTrackEntry(norad_id=25544, samples=[_sample(t), _sample(t)])],
    )
    body = res.model_dump(mode="json")
    assert body["entries"][0]["norad_id"] == 25544
    assert len(body["entries"][0]["samples"]) == 2
