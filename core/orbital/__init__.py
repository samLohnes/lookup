"""Orbital mechanics — pass prediction + trajectory sampling."""
from core.orbital.passes import predict_passes

__all__ = ["predict_passes", "sample_track"]


def __getattr__(name: str):  # pragma: no cover
    """Lazy import for sample_track to avoid circular dependency with core.visibility."""
    if name == "sample_track":
        from core.orbital.tracking import sample_track
        return sample_track
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
