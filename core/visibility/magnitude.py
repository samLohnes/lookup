"""Visual-magnitude estimator for satellites.

Standard model:
    m = m_intrinsic + 5·log10(range_km / 1000)  + phase_correction(phase_angle)

The intrinsic magnitude `m_intrinsic` is defined at 1000 km range and a phase
angle of 0° (fully lit). A phase correction — here, a simple empirical
form based on Lambertian scattering — penalises back-lit geometry.

ISS intrinsic magnitude is a widely-cited value of approximately -1.3,
calibrated by amateur observations. For other objects we use a coarser
default.
"""
from __future__ import annotations

import math

ISS_INTRINSIC_MAGNITUDE = -1.3
DEFAULT_INTRINSIC_MAGNITUDE = 4.0  # conservative dim default for unknown objects


def _phase_correction_deg(phase_angle_deg: float) -> float:
    """Lambertian-sphere phase correction, magnitudes.

    At phase 0° → 0 mag penalty. At 90° → ~1.24. At 180° → diverges;
    clamped in practice to ~7 mag.
    """
    phi = math.radians(min(max(phase_angle_deg, 0.0), 179.9))
    sin_phi = math.sin(phi)
    cos_phi = math.cos(phi)
    # Lambertian phase function f(phi) = ((pi - phi)*cos + sin) / pi
    fphi = ((math.pi - phi) * cos_phi + sin_phi) / math.pi
    if fphi <= 0:
        return 7.0  # effectively invisible
    return -2.5 * math.log10(fphi)


def compute_magnitude(
    range_km: float,
    phase_angle_deg: float,
    intrinsic_magnitude: float = DEFAULT_INTRINSIC_MAGNITUDE,
) -> float:
    """Estimate visual magnitude of a satellite.

    Args:
        range_km: Observer-to-satellite distance in km.
        phase_angle_deg: Sun–sat–observer angle in degrees. 0° = fully
            front-lit; 180° = back-lit.
        intrinsic_magnitude: Absolute magnitude at 1000 km, phase 0°.
            Use `ISS_INTRINSIC_MAGNITUDE` for the ISS.

    Returns:
        Apparent visual magnitude (lower = brighter; e.g. -2 is bright,
        +5 is faint).
    """
    range_term = 5.0 * math.log10(max(range_km, 1e-6) / 1000.0)
    phase_term = _phase_correction_deg(phase_angle_deg)
    return intrinsic_magnitude + range_term + phase_term
