"""Tests for core.terrain.fetcher."""
from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock


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


def test_get_elevation_m_returns_center_pixel(tmp_path: Path, synth_dem_tile_bytes: bytes):
    """The synthetic 3x3 DEM peaks at 120 m in the centre cell."""
    fetcher = TerrainFetcher(client=_client_returning(synth_dem_tile_bytes), cache_root=tmp_path)
    elev = fetcher.get_elevation_m(lat=0.0, lng=0.0, radius_km=1)
    assert elev == 120.0


def test_get_elevation_m_uses_dem_cache_on_second_call(tmp_path: Path, synth_dem_tile_bytes: bytes):
    """Repeat lookups at the same lat/lng/radius should not refetch."""
    fetcher = TerrainFetcher(client=_client_returning(synth_dem_tile_bytes), cache_root=tmp_path)
    fetcher.get_elevation_m(lat=0.0, lng=0.0, radius_km=1)

    fail_client = MagicMock(spec=OpenTopoClient)
    fail_client.fetch.side_effect = AssertionError("should not be called")
    fetcher2 = TerrainFetcher(client=fail_client, cache_root=tmp_path)
    elev = fetcher2.get_elevation_m(lat=0.0, lng=0.0, radius_km=1)
    assert elev == 120.0
    fail_client.fetch.assert_not_called()


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
