"""Pydantic settings for the API — read from env vars or defaults."""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration."""

    cache_root: str = str(Path.home() / ".satvis")
    tle_max_age_hours: int = 24
    horizon_radius_km: int = 50
    opentopography_api_key: str | None = None

    model_config = SettingsConfigDict(env_prefix="SATVIS_", env_file=".env", extra="ignore")
