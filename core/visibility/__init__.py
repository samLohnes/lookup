"""Visibility — darkness, sunlit, magnitude, filtering."""
from __future__ import annotations

__all__ = [
    "ASTRONOMICAL_TWILIGHT_DEG",
    "CIVIL_TWILIGHT_DEG",
    "DEFAULT_INTRINSIC_MAGNITUDE",
    "ISS_INTRINSIC_MAGNITUDE",
    "NAUTICAL_TWILIGHT_DEG",
    "compute_magnitude",
    "filter_passes",
    "is_observer_in_darkness",
    "is_satellite_sunlit",
]


def __getattr__(name: str):  # pragma: no cover
    """Lazy import to avoid circular dependencies."""
    if name == "ASTRONOMICAL_TWILIGHT_DEG":
        from core.visibility.darkness import ASTRONOMICAL_TWILIGHT_DEG
        return ASTRONOMICAL_TWILIGHT_DEG
    elif name == "CIVIL_TWILIGHT_DEG":
        from core.visibility.darkness import CIVIL_TWILIGHT_DEG
        return CIVIL_TWILIGHT_DEG
    elif name == "NAUTICAL_TWILIGHT_DEG":
        from core.visibility.darkness import NAUTICAL_TWILIGHT_DEG
        return NAUTICAL_TWILIGHT_DEG
    elif name == "is_observer_in_darkness":
        from core.visibility.darkness import is_observer_in_darkness
        return is_observer_in_darkness
    elif name == "filter_passes":
        from core.visibility.filter import filter_passes
        return filter_passes
    elif name == "DEFAULT_INTRINSIC_MAGNITUDE":
        from core.visibility.magnitude import DEFAULT_INTRINSIC_MAGNITUDE
        return DEFAULT_INTRINSIC_MAGNITUDE
    elif name == "ISS_INTRINSIC_MAGNITUDE":
        from core.visibility.magnitude import ISS_INTRINSIC_MAGNITUDE
        return ISS_INTRINSIC_MAGNITUDE
    elif name == "compute_magnitude":
        from core.visibility.magnitude import compute_magnitude
        return compute_magnitude
    elif name == "is_satellite_sunlit":
        from core.visibility.sunlit import is_satellite_sunlit
        return is_satellite_sunlit
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
