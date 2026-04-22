"""Request-body Pydantic models for the API."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class _ObserverFields(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)
    elevation_m: float = 0.0


class PassesRequest(_ObserverFields):
    """Request body for the /passes endpoint."""

    query: str = Field(..., min_length=1)
    from_utc: datetime
    to_utc: datetime
    mode: Literal["line-of-sight", "naked-eye"] = "line-of-sight"
    min_magnitude: float | None = None


class SkyTrackRequest(_ObserverFields):
    """Request body for the /sky-track endpoint."""

    query: str = Field(..., min_length=1)
    from_utc: datetime
    to_utc: datetime
    dt_seconds: int = Field(1, ge=1, le=3600)
