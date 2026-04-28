"""Request-body Pydantic models for the API."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class _ObserverFields(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)
    elevation_m: float = 0.0


class PassesRequest(_ObserverFields):
    query: str = Field(..., min_length=1)
    from_utc: datetime
    to_utc: datetime
    mode: Literal["line-of-sight", "naked-eye"] = "line-of-sight"
    min_magnitude: float | None = None
    min_peak_elevation_deg: float | None = Field(
        default=None,
        description=(
            "Drop passes whose peak elevation is below this (degrees). "
            "If None, no elevation floor is applied unless the caller is making "
            "a group query and `apply_group_defaults` is true, in which case "
            "the default 30° floor is used."
        ),
    )
    apply_group_defaults: bool = Field(
        default=True,
        description=(
            "When true (default) and the query resolves to a group, automatically "
            "apply the default 'notable passes' filters: peak elevation ≥ 30° "
            "and (in naked-eye mode) magnitude ≤ +4. Explicit `min_magnitude` "
            "and `min_peak_elevation_deg` values always win over the defaults."
        ),
    )

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "lat": 40.7128,
                    "lng": -74.0060,
                    "elevation_m": 10,
                    "query": "ISS",
                    "from_utc": "2026-05-01T00:00:00Z",
                    "to_utc": "2026-05-08T00:00:00Z",
                    "mode": "line-of-sight",
                }
            ]
        }
    }


class SkyTrackRequest(_ObserverFields):
    query: str = Field(..., min_length=1)
    from_utc: datetime
    to_utc: datetime
    dt_seconds: int = Field(1, ge=1, le=3600)

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "lat": 40.7128,
                    "lng": -74.0060,
                    "elevation_m": 10,
                    "query": "ISS",
                    "from_utc": "2026-05-01T00:00:00Z",
                    "to_utc": "2026-05-01T00:10:00Z",
                    "dt_seconds": 5,
                }
            ]
        }
    }


class _ObserverFieldsWithNorads(_ObserverFields):
    # max_length=200 is well above realistic group sizes (Starlink trains
    # are ~60 sats max in current catalog) and prevents trivial DoS via
    # huge norad lists forcing thousands of Skyfield propagations.
    norad_ids: list[int] = Field(..., min_length=1, max_length=200)


class NowPositionsRequest(_ObserverFieldsWithNorads):
    """Single-instant position(s) for one or more satellites.

    Polled by the frontend live-mode loop at ~5s cadence.
    """

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "lat": 40.7128,
                    "lng": -74.0060,
                    "elevation_m": 10,
                    "norad_ids": [25544],
                }
            ]
        }
    }


class NowTracksRequest(_ObserverFieldsWithNorads):
    """Trailing track(s) for one or more satellites.

    Called once per satellite-change to seed the rolling trail buffer
    on the frontend; not a recurring poll.
    """

    tail_minutes: int = Field(10, ge=1, le=60)
    dt_seconds: int = Field(30, ge=1, le=300)

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "lat": 40.7128,
                    "lng": -74.0060,
                    "elevation_m": 10,
                    "norad_ids": [25544],
                    "tail_minutes": 10,
                    "dt_seconds": 30,
                }
            ]
        }
    }
