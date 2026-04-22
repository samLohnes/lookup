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
    query: str = Field(..., min_length=1)
    from_utc: datetime
    to_utc: datetime
    mode: Literal["line-of-sight", "naked-eye"] = "line-of-sight"
    min_magnitude: float | None = None
    min_peak_elevation_deg: float | None = Field(
        default=None,
        description=(
            "Drop passes whose peak elevation is below this (degrees). "
            "If None, no elevation floor is applied unless the caller is making "
            "a group query and `apply_group_defaults` is true, in which case "
            "the default 30° floor is used."
        ),
    )
    apply_group_defaults: bool = Field(
        default=True,
        description=(
            "When true (default) and the query resolves to a group, automatically "
            "apply the default 'notable passes' filters: peak elevation ≥ 30° "
            "and (in naked-eye mode) magnitude ≤ +4. Explicit `min_magnitude` "
            "and `min_peak_elevation_deg` values always win over the defaults."
        ),
    )


class SkyTrackRequest(_ObserverFields):
    query: str = Field(..., min_length=1)
    from_utc: datetime
    to_utc: datetime
    dt_seconds: int = Field(1, ge=1, le=3600)
