"""Orbital mechanics — pass prediction + trajectory sampling."""
from __future__ import annotations

__all__ = ["predict_passes", "sample_track"]


def __getattr__(name: str):
    """Lazy import to avoid circular dependencies."""
    if name == "predict_passes":
        from core.orbital.passes import predict_passes
        return predict_passes
    elif name == "sample_track":
        from core.orbital.tracking import sample_track
        return sample_track
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
