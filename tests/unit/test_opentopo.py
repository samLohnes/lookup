"""Tests for core.terrain.opentopo."""
from __future__ import annotations

import os
from unittest.mock import patch

import httpx
import pytest

from core.terrain.opentopo import (
    OpenTopoClient,
    OpenTopoError,
    bbox_for_radius_km,
    opentopo_url,
)

# A tiny "fake GeoTIFF" — we test that the client returns the raw bytes
# unchanged. Real parsing happens in test_dem_cache / test_horizon.
FAKE_TIFF = b"II*\x00fake geotiff bytes"


def test_bbox_for_radius_km_is_centered():
    south, north, west, east = bbox_for_radius_km(lat=40.7128, lng=-74.0060, radius_km=50)
    # Latitude half-width ≈ 50/111 ≈ 0.45°; longitude half-width compensated by cos(lat).
    assert north - south == pytest.approx(2 * 50 / 111.0, abs=0.02)
    # Symmetry
    mid_lat = (south + north) / 2
    mid_lng = (west + east) / 2
    assert mid_lat == pytest.approx(40.7128, abs=1e-6)
    assert mid_lng == pytest.approx(-74.0060, abs=1e-6)


def test_url_contains_required_params():
    url = opentopo_url(south=40.0, north=41.0, west=-75.0, east=-74.0, api_key="TESTKEY")
    assert "demtype=COP30" in url
    assert "south=40.0" in url
    assert "north=41.0" in url
    assert "west=-75.0" in url
    assert "east=-74.0" in url
    assert "outputFormat=GTiff" in url
    assert "API_Key=TESTKEY" in url


def test_fetch_returns_raw_bytes():
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=FAKE_TIFF, headers={"content-type": "image/tiff"})

    client = OpenTopoClient(api_key="TESTKEY", transport=httpx.MockTransport(handler))
    data = client.fetch(lat=40.7128, lng=-74.0060, radius_km=5)
    assert data == FAKE_TIFF


def test_fetch_raises_on_missing_key():
    with patch.dict(os.environ, {}, clear=True):
        with pytest.raises(OpenTopoError, match="API key"):
            OpenTopoClient().fetch(lat=0.0, lng=0.0, radius_km=5)


def test_fetch_raises_on_http_error():
    transport = httpx.MockTransport(lambda req: httpx.Response(403, text="Forbidden"))
    client = OpenTopoClient(api_key="TESTKEY", transport=transport)
    with pytest.raises(OpenTopoError, match="HTTP 403"):
        client.fetch(lat=0.0, lng=0.0, radius_km=5)
