"""Shared dataclasses for the satellite-visibility engine.

All types are frozen to keep the engine's data flow immutable and safe
to share across threads/coroutines without copying.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal, Optional

VisibilityMode = Literal["line-of-sight", "naked-eye"]


@dataclass(frozen=True, slots=True)
class Observer:
    """A fixed observation location on Earth.

    Args:
        lat: Latitude in degrees, positive north.
        lng: Longitude in degrees, positive east.
        elevation_m: Height above WGS84 ellipsoid in metres.
        name: Optional human-friendly label ("Backyard").
    """

    lat: float
    lng: float
    elevation_m: float
    name: Optional[str] = None


@dataclass(frozen=True, slots=True)
class AngularPosition:
    """Horizontal-coordinate position in the observer's sky."""

    azimuth_deg: float
    elevation_deg: float


@dataclass(frozen=True, slots=True)
class PassEndpoint:
    """A single (time, sky-position) event within a pass (rise/peak/set)."""

    time: datetime
    position: AngularPosition


@dataclass(frozen=True, slots=True)
class TLE:
    """A two-line element set describing an object's orbital state at an epoch.

    Args:
        norad_id: NORAD catalog number.
        name: Satellite name as published by the TLE source.
        line1: Raw TLE line 1 (69-char).
        line2: Raw TLE line 2 (69-char).
        epoch: UTC timestamp this TLE is valid at.
    """

    norad_id: int
    name: str
    line1: str
    line2: str
    epoch: datetime


@dataclass(frozen=True, slots=True)
class BlockedAzimuthRange:
    """An azimuth range where local terrain blocks visibility during this pass."""

    start_azimuth_deg: float
    end_azimuth_deg: float
    duration_s: float


@dataclass(frozen=True, slots=True)
class Pass:
    """A visibility window for a single satellite over a single observer.

    Geometric info (rise/peak/set) is always present. Optical info
    (max_magnitude, sunlit_fraction) is populated when visibility mode
    was computed — may be None for pure line-of-sight queries.
    """

    id: str
    norad_id: int
    name: str
    rise: PassEndpoint
    peak: PassEndpoint
    set: PassEndpoint
    duration_s: int
    max_magnitude: Optional[float]
    sunlit_fraction: float
    tle_epoch: datetime
    terrain_blocked_ranges: tuple[BlockedAzimuthRange, ...] = field(default_factory=tuple)


@dataclass(frozen=True, slots=True)
class TrackSample:
    """A single sample along a satellite's trajectory as seen from the observer."""

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


@dataclass(frozen=True, slots=True)
class HorizonMask:
    """360-sample mask of minimum visible elevation per azimuth (degrees).

    Convention: mask[i] is the minimum elevation (in degrees) at azimuth
    i degrees (0..359). Missing samples can be interpolated linearly.
    """

    samples_deg: tuple[float, ...]

    def min_elevation_at(self, azimuth_deg: float) -> float:
        """Return the min-elevation threshold at the given azimuth."""
        i = int(round(azimuth_deg)) % len(self.samples_deg)
        return self.samples_deg[i]


@dataclass(frozen=True, slots=True)
class CatalogHit:
    """One fuzzy-search result with its match score."""

    display_name: str
    match_type: Literal["satellite", "group"]
    norad_ids: tuple[int, ...]
    score: float  # 0..100 from rapidfuzz


@dataclass(frozen=True, slots=True)
class Resolution:
    """The resolved interpretation of a user query."""

    type: Literal["single", "group"]
    norad_ids: tuple[int, ...]
    display_name: str
