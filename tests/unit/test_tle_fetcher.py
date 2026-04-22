"""Tests for core.catalog.fetcher."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import pytest

from core.catalog.celestrak import CelestrakClient
from core.catalog.fetcher import TLEFetcher

FIX_ISS = Path(__file__).resolve().parents[1] / "fixtures" / "celestrak" / "iss_single.txt"
FIX_STATIONS = Path(__file__).resolve().parents[1] / "fixtures" / "celestrak" / "stations_group.txt"


def _client_from_file(path: Path) -> CelestrakClient:
    body = path.read_text()
    transport = httpx.MockTransport(lambda req: httpx.Response(200, text=body))
    return CelestrakClient(transport=transport)


def test_get_tle_fetches_on_cold_cache(tmp_path: Path):
    client = _client_from_file(FIX_ISS)
    now = datetime(2026, 4, 20, 19, 0, 0, tzinfo=timezone.utc)
    fetcher = TLEFetcher(client=client, cache_root=tmp_path, now=lambda: now)

    tle, age_s = fetcher.get_tle(25544)

    assert tle.norad_id == 25544
    assert age_s == 0.0


def test_get_tle_uses_cache_when_fresh(tmp_path: Path):
    client = _client_from_file(FIX_ISS)
    now = [datetime(2026, 4, 20, 19, 0, 0, tzinfo=timezone.utc)]
    fetcher = TLEFetcher(client=client, cache_root=tmp_path, now=lambda: now[0])

    # First call: populates cache.
    fetcher.get_tle(25544)

    # Advance clock 1h (well under 24h threshold); expect no re-fetch.
    now[0] += timedelta(hours=1)

    # Swap client out to a transport that would fail if contacted.
    fail_transport = httpx.MockTransport(lambda req: httpx.Response(500, text="should not hit"))
    fetcher._client = CelestrakClient(transport=fail_transport)  # type: ignore[attr-defined]

    tle, age_s = fetcher.get_tle(25544)
    assert tle.norad_id == 25544
    assert age_s == pytest.approx(3600.0)


def test_get_tle_refreshes_when_stale(tmp_path: Path):
    client = _client_from_file(FIX_ISS)
    now = [datetime(2026, 4, 20, 19, 0, 0, tzinfo=timezone.utc)]
    fetcher = TLEFetcher(client=client, cache_root=tmp_path, now=lambda: now[0])

    fetcher.get_tle(25544)

    # Fast-forward 25h → stale.
    now[0] += timedelta(hours=25)

    # New client that returns the same fixture — verifies the re-fetch path runs.
    fetcher._client = _client_from_file(FIX_ISS)  # type: ignore[attr-defined]

    tle, age_s = fetcher.get_tle(25544)
    assert tle.norad_id == 25544
    assert age_s == 0.0  # just refreshed


def test_get_group_tles_returns_list(tmp_path: Path):
    client = _client_from_file(FIX_STATIONS)
    now = datetime(2026, 4, 20, 19, 0, 0, tzinfo=timezone.utc)
    fetcher = TLEFetcher(client=client, cache_root=tmp_path, now=lambda: now)

    tles, age_s = fetcher.get_group_tles("stations")

    assert len(tles) == 2
    assert {t.norad_id for t in tles} == {25544, 48274}
    assert age_s == 0.0


def test_rate_limiter_enforces_minimum_spacing():
    from core.catalog.fetcher import RateLimiter

    ticks = [0.0]

    def now_s() -> float:
        return ticks[0]

    def sleeper(duration_s: float) -> None:
        ticks[0] += duration_s

    limiter = RateLimiter(max_per_second=2.0, now_s=now_s, sleep=sleeper)

    # First call: no wait.
    limiter.wait_if_needed()
    assert ticks[0] == 0.0

    # Second call immediately after: must sleep ~0.5s.
    limiter.wait_if_needed()
    assert ticks[0] == pytest.approx(0.5, abs=1e-6)
