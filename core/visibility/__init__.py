"""Visibility — darkness, sunlit, magnitude, filtering."""
from core.visibility.darkness import (
    ASTRONOMICAL_TWILIGHT_DEG,
    CIVIL_TWILIGHT_DEG,
    NAUTICAL_TWILIGHT_DEG,
    is_observer_in_darkness,
)
from core.visibility.magnitude import (
    DEFAULT_INTRINSIC_MAGNITUDE,
    ISS_INTRINSIC_MAGNITUDE,
    compute_magnitude,
)
from core.visibility.sunlit import is_satellite_sunlit

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
    """Lazy import for filter_passes to avoid circular dependency with core.orbital."""
    if name == "filter_passes":
        from core.visibility.filter import filter_passes
        return filter_passes
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
