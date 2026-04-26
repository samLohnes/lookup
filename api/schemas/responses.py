"""Response Pydantic models — mirror engine types for JSON serialization."""
from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional, Union

from pydantic import BaseModel

from core._types import Pass, TrackSample, TrainPass


class AngularPositionResponse(BaseModel):
    """Azimuth/elevation pair in the observer's horizontal coordinate frame."""

    azimuth_deg: float
    elevation_deg: float


class PassEndpointResponse(BaseModel):
    """A single (time, sky-position, range) event within a pass."""

    time: datetime
    azimuth_deg: float
    elevation_deg: float
    range_km: float


class PassResponse(BaseModel):
    """JSON representation of a single-satellite visibility window."""

    kind: Literal["single"] = "single"
    id: str
    norad_id: int
    name: str
    rise: PassEndpointResponse
    peak: PassEndpointResponse
    set: PassEndpointResponse
    duration_s: int
    max_magnitude: Optional[float]
    sunlit_fraction: float
    tle_epoch: datetime
    peak_angular_speed_deg_s: float
    naked_eye_visible: Optional[Literal["yes", "no", "partial"]] = None


class TrainPassResponse(BaseModel):
    """JSON representation of an aggregated satellite-train visibility window."""

    kind: Literal["train"] = "train"
    id: str
    name: str
    member_norad_ids: list[int]
    rise: PassEndpointResponse
    peak: PassEndpointResponse
    set: PassEndpointResponse
    duration_s: int
    max_magnitude: Optional[float]
    member_count: int


class TrackSampleResponse(BaseModel):
    """One point along a satellite's sky trajectory as seen from the observer."""

    time: datetime
    lat: float
    lng: float
    alt_km: float
    az: float
    el: float
    range_km: float
    velocity_km_s: float
    magnitude: Optional[float]
    sunlit: bool
    observer_dark: bool


class TLEFreshnessResponse(BaseModel):
    """Metadata about the age of a TLE record."""

    norad_id: int
    name: str
    tle_epoch: datetime
    fetched_age_seconds: float


class HorizonResponse(BaseModel):
    """Horizon mask for a given observer location."""

    lat: float
    lng: float
    radius_km: int
    samples_deg: list[float]


class CatalogHitResponse(BaseModel):
    """A single fuzzy-search result from the satellite catalog."""

    display_name: str
    match_type: Literal["satellite", "group"]
    norad_ids: list[int]
    score: float


class GeoTimezoneResponse(BaseModel):
    """IANA timezone at a given observer location."""

    lat: float
    lng: float
    timezone: str  # IANA name, e.g. "America/New_York" or "Etc/GMT+5" for ocean points


class ElevationResponse(BaseModel):
    """DEM-sampled terrain elevation (metres above sea level) at a lat/lng."""

    lat: float
    lng: float
    elevation_m: float


class PassesResponse(BaseModel):
    """Top-level response envelope for the /passes endpoint."""

    query: str
    resolved_name: str
    passes: list[Union[PassResponse, TrainPassResponse]]
    tle_age_seconds: Optional[float]


def _endpoint_to_response(ep: object) -> PassEndpointResponse:
    """Convert a PassEndpoint dataclass to its response model."""
    return PassEndpointResponse(
        time=ep.time,  # type: ignore[attr-defined]
        azimuth_deg=ep.position.azimuth_deg,  # type: ignore[attr-defined]
        elevation_deg=ep.position.elevation_deg,  # type: ignore[attr-defined]
        range_km=ep.range_km,  # type: ignore[attr-defined]
    )


def pass_to_response(p: Pass) -> PassResponse:
    """Convert a Pass dataclass to its JSON response model."""
    return PassResponse(
        id=p.id,
        norad_id=p.norad_id,
        name=p.name,
        rise=_endpoint_to_response(p.rise),
        peak=_endpoint_to_response(p.peak),
        set=_endpoint_to_response(p.set),
        duration_s=p.duration_s,
        max_magnitude=p.max_magnitude,
        sunlit_fraction=p.sunlit_fraction,
        tle_epoch=p.tle_epoch,
        peak_angular_speed_deg_s=p.peak_angular_speed_deg_s,
        naked_eye_visible=p.naked_eye_visible,
    )


def trainpass_to_response(tp: TrainPass) -> TrainPassResponse:
    """Convert a TrainPass dataclass to its JSON response model."""
    return TrainPassResponse(
        id=tp.id,
        name=tp.name,
        member_norad_ids=list(tp.member_norad_ids),
        rise=_endpoint_to_response(tp.rise),
        peak=_endpoint_to_response(tp.peak),
        set=_endpoint_to_response(tp.set),
        duration_s=tp.duration_s,
        max_magnitude=tp.max_magnitude,
        member_count=len(tp.member_passes),
    )


class SkyTrackResponse(BaseModel):
    """Response envelope for POST /sky-track."""

    resolved_name: str
    samples: list[TrackSampleResponse]


def track_sample_to_response(s: TrackSample) -> TrackSampleResponse:
    """Convert a TrackSample dataclass to its JSON response model."""
    return TrackSampleResponse(
        time=s.time,
        lat=s.lat,
        lng=s.lng,
        alt_km=s.alt_km,
        az=s.az,
        el=s.el,
        range_km=s.range_km,
        velocity_km_s=s.velocity_km_s,
        magnitude=s.magnitude,
        sunlit=s.sunlit,
        observer_dark=s.observer_dark,
    )
