"""Visibility — darkness, sunlit, magnitude.

Note: `filter_passes` is intentionally NOT re-exported here. It depends on
`core.orbital.tracking`, which in turn depends on this package; re-exporting
`filter_passes` from the package root creates a circular import during module
load. Import it directly from `core.visibility.filter` instead.
"""
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
    "is_observer_in_darkness",
    "is_satellite_sunlit",
]
