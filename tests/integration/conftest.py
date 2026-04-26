"""Shared fixtures for integration tests."""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from core._types import HorizonMask


@pytest.fixture
def fake_terrain() -> MagicMock:
    """Terrain fetcher mock returning a flat zero-elevation horizon mask."""
    fake = MagicMock()
    fake.get_horizon_mask.return_value = HorizonMask(
        samples_deg=tuple(0.0 for _ in range(360)),
    )
    return fake
