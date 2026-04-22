"""Tests for core.catalog.celestrak."""
from __future__ import annotations

from pathlib import Path

import httpx
import pytest

from core.catalog.celestrak import (
    CelestrakClient,
    CelestrakError,
    celestrak_url,
)

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "celestrak"


def _mock_transport_from_file(path: Path, status: int = 200):
    body = path.read_text()

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(status, text=body, headers={"content-type": "text/plain"})

    return httpx.MockTransport(handler)


def test_url_for_single_norad():
    url = celestrak_url(norad_id=25544)
    assert "CATNR=25544" in url
    assert "FORMAT=3LE" in url


def test_url_for_group():
    url = celestrak_url(group="stations")
    assert "GROUP=stations" in url
    assert "FORMAT=3LE" in url


def test_url_raises_if_neither_given():
    with pytest.raises(ValueError, match="must specify"):
        celestrak_url()


def test_fetch_single_returns_one_tle():
    transport = _mock_transport_from_file(FIXTURES / "iss_single.txt")
    client = CelestrakClient(transport=transport)

    tles = client.fetch_single(norad_id=25544)

    assert len(tles) == 1
    tle = tles[0]
    assert tle.norad_id == 25544
    assert tle.name == "ISS (ZARYA)"
    # Epoch parsed from TLE line 1
    assert tle.epoch.year == 2026


def test_fetch_group_returns_multiple_tles():
    transport = _mock_transport_from_file(FIXTURES / "stations_group.txt")
    client = CelestrakClient(transport=transport)

    tles = client.fetch_group("stations")

    assert len(tles) == 2
    norad_ids = {t.norad_id for t in tles}
    assert norad_ids == {25544, 48274}


def test_fetch_raises_on_http_error():
    transport = _mock_transport_from_file(FIXTURES / "iss_single.txt", status=500)
    client = CelestrakClient(transport=transport)

    with pytest.raises(CelestrakError, match="HTTP 500"):
        client.fetch_single(norad_id=25544)


def test_fetch_raises_on_empty_response():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="", headers={"content-type": "text/plain"})

    client = CelestrakClient(transport=httpx.MockTransport(handler))

    with pytest.raises(CelestrakError, match="no results"):
        client.fetch_single(norad_id=99999)


def test_fetch_handles_0_prefixed_name_line():
    """Some Celestrak feeds emit the name line with a leading '0 ' prefix."""
    body = (
        "0 ISS (ZARYA)\n"
        "1 25544U 98067A   26110.78039753  .00010000  00000-0  18000-3 0  9990\n"
        "2 25544  51.6406 224.2064 0006726 330.9385  29.0851 15.50000000 99990\n"
    )
    transport = httpx.MockTransport(lambda req: httpx.Response(200, text=body))
    client = CelestrakClient(transport=transport)

    tles = client.fetch_single(norad_id=25544)

    assert len(tles) == 1
    assert tles[0].name == "ISS (ZARYA)"


def test_fetch_rejects_malformed_text():
    """A 3LE response with a non-multiple-of-3 line count is an error."""
    body = (
        "ISS (ZARYA)\n"
        "1 25544U 98067A   26110.78039753  .00010000  00000-0  18000-3 0  9990\n"
        # missing line 2
    )
    transport = httpx.MockTransport(lambda req: httpx.Response(200, text=body))
    client = CelestrakClient(transport=transport)

    with pytest.raises(CelestrakError, match="not a multiple of 3"):
        client.fetch_single(norad_id=25544)
