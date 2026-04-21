"""Tests for core.terrain.fetcher."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import pytest

from core._types import Observer
from core.terrain.fetcher import TerrainFetcher
from core.terrain.opentopo import OpenTopoClient


def _client_returning(bytes_: bytes) -> OpenTopoClient:
    import httpx

    transport = httpx.MockTransport(lambda req: httpx.Response(200, content=bytes_))
    return OpenTopoClient(api_key="TESTKEY", transport=transport)


def test_first_call_fetches_and_computes(tmp_path: Path, synth_dem_tile_bytes: bytes):
    fetcher = TerrainFetcher(client=_client_returning(synth_dem_tile_bytes), cache_root=tmp_path)
    observer = Observer(lat=0.0, lng=0.0, elevation_m=100.0)

    mask = fetcher.get_horizon_mask(observer)

    assert len(mask.samples_deg) == 360


def test_second_call_uses_mask_cache_without_hitting_client(tmp_path: Path, synth_dem_tile_bytes: bytes):
    observer = Observer(lat=0.0, lng=0.0, elevation_m=100.0)

    # Warm both caches with a real client.
    fetcher = TerrainFetcher(client=_client_returning(synth_dem_tile_bytes), cache_root=tmp_path)
    first = fetcher.get_horizon_mask(observer)

    # Now swap in a client that would fail — second call must not call it.
    fail_client = MagicMock(spec=OpenTopoClient)
    fail_client.fetch.side_effect = AssertionError("should not be called")
    fetcher2 = TerrainFetcher(client=fail_client, cache_root=tmp_path)

    second = fetcher2.get_horizon_mask(observer)

    assert first.samples_deg == second.samples_deg
    fail_client.fetch.assert_not_called()
