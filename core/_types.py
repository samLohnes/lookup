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
    """A single (time, sky-position, range) event within a pass (rise/peak/set)."""

    time: datetime
    position: AngularPosition
    range_km: float


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

    Geometric info (rise/peak/set, range, peak angular speed) is always
    present. Optical info (max_magnitude, sunlit_fraction, naked_eye_visible)
    is populated when visibility mode was computed — may be None for pure
    line-of-sight queries.
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
    peak_angular_speed_deg_s: float = 0.0
    naked_eye_visible: Optional[Literal["yes", "no", "partial"]] = None
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

    def __post_init__(self) -> None:
        if len(self.samples_deg) != 360:
            raise ValueError(
                f"HorizonMask requires exactly 360 samples (one per degree of azimuth); "
                f"got {len(self.samples_deg)}"
            )

    def min_elevation_at(self, azimuth_deg: float) -> float:
        """Return the min-elevation threshold at the given azimuth."""
        i = int(round(azimuth_deg)) % len(self.samples_deg)
        return self.samples_deg[i]


@dataclass(frozen=True, slots=True)
class CatalogHit:
    """One fuzzy-search result with its match score."""

    display_name: str
    match_type: Literal["satellite", "group", "train_query"]
    norad_ids: tuple[int, ...]
    score: float  # 0..100 from rapidfuzz
    query_kind: Optional[str] = None


@dataclass(frozen=True, slots=True)
class Resolution:
    """The resolved interpretation of a user query."""

    type: Literal["single", "group", "train_query"]
    norad_ids: tuple[int, ...]
    display_name: str
    query_kind: Optional[str] = None


# ---------------------------------------------------------------------------
# M2 additions
# ---------------------------------------------------------------------------


@dataclass(frozen=True, slots=True)
class TrainPass:
    """An aggregated pass event representing a co-flying batch of satellites.

    Produced by `core.trains.clustering.group_into_trains` when multiple
    individual passes have near-simultaneous rises and parallel ground
    tracks (e.g. a freshly-launched Starlink train).

    The rise/peak/set endpoints are the envelope of the member passes:
    earliest rise, latest set, median-ish peak.
    """

    id: str
    name: str
    member_norad_ids: tuple[int, ...]
    rise: "PassEndpoint"
    peak: "PassEndpoint"
    set: "PassEndpoint"
    duration_s: int
    max_magnitude: Optional[float]
    member_passes: tuple["Pass", ...]


@dataclass(frozen=True, slots=True)
class DEM:
    """A raster elevation tile covering a geographic bounding box.

    Attributes:
        south_lat, north_lat: WGS84 latitude bounds in degrees.
        west_lng, east_lng: WGS84 longitude bounds in degrees.
        elevations: 2-D float32 numpy array, shape (rows, cols). `elevations[0,0]`
            is the north-west corner; rows increase southward, cols eastward.
    """

    south_lat: float
    north_lat: float
    west_lng: float
    east_lng: float
    elevations: "object"  # Typed loosely to avoid forcing numpy imports at type-check time.

    @property
    def shape(self) -> tuple[int, int]:
        """(rows, cols) of the underlying array."""
        return tuple(self.elevations.shape)  # type: ignore[attr-defined]
