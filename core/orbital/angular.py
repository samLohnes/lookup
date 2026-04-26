"""Great-circle angular distance between two (azimuth, elevation) points.

Used to compute angular speed across the celestial sphere by sampling a pair
of points bracketing peak culmination. Naive `Δaz` is wrong near zenith,
where small movements correspond to large azimuth shifts; the spherical-
triangle formula keeps this honest.
"""
from __future__ import annotations

import math


def angular_distance_deg(
    az1_deg: float,
    el1_deg: float,
    az2_deg: float,
    el2_deg: float,
) -> float:
    """Great-circle separation between two horizontal-coordinate points, in degrees.

    Args:
        az1_deg, el1_deg: First point in observer-relative az/el (degrees).
        az2_deg, el2_deg: Second point in the same frame.

    Returns:
        Angular distance in degrees, in [0, 180].
    """
    el1 = math.radians(el1_deg)
    el2 = math.radians(el2_deg)
    daz = math.radians(az2_deg - az1_deg)
    cos_d = math.sin(el1) * math.sin(el2) + math.cos(el1) * math.cos(el2) * math.cos(daz)
    cos_d = max(-1.0, min(1.0, cos_d))
    return math.degrees(math.acos(cos_d))
