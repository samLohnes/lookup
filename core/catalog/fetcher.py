"""TLE fetcher — orchestrates Celestrak client + disk cache with a 24h freshness window.

Exposes the public engine API:
    - get_tle(norad_id) -> (TLE, age_seconds)
    - get_group_tles(group_name) -> (list[TLE], age_seconds)

The `age_seconds` value lets callers surface TLE freshness per result
(e.g. in an API response) without re-reading the cache metadata.
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable

from core._types import TLE
from core.catalog.celestrak import CelestrakClient
from core.catalog.tle_cache import TLECache


class RateLimiter:
    """Minimal rolling-window rate limiter.

    Enforces a ceiling of `max_per_second` by sleeping if the previous call
    was too recent. Monotonic clock by default; both clock and sleep are
    injectable for tests.
    """

    def __init__(
        self,
        *,
        max_per_second: float = 2.0,
        now_s: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        if max_per_second <= 0:
            raise ValueError("max_per_second must be positive")
        self._min_gap_s = 1.0 / max_per_second
        self._now_s = now_s
        self._sleep = sleep
        self._last_call_s: float | None = None

    def wait_if_needed(self) -> None:
        """Sleep if needed to stay within the configured rate limit."""
        now = self._now_s()
        if self._last_call_s is not None:
            elapsed = now - self._last_call_s
            if elapsed < self._min_gap_s:
                self._sleep(self._min_gap_s - elapsed)
                now = self._now_s()
        self._last_call_s = now


DEFAULT_TLE_MAX_AGE = timedelta(hours=24)


class TLEFetcher:
    """Read-through cache for Celestrak TLEs.

    Age policy: return the cached record if it's younger than `max_age`;
    otherwise re-fetch, overwrite the cache, and return the fresh record.
    On fetch errors with a populated cache, the fetcher falls back to the
    stale cached entry rather than raising — the caller can decide via
    `age_seconds` whether that's acceptable.
    """

    def __init__(
        self,
        *,
        client: CelestrakClient,
        cache_root: Path,
        max_age: timedelta = DEFAULT_TLE_MAX_AGE,
        rate_limiter: RateLimiter | None = None,
        now: Callable[[], datetime] = lambda: datetime.now(timezone.utc),
    ) -> None:
        self._client = client
        self._cache = TLECache(root=cache_root)
        self._max_age = max_age
        self._rate_limiter = rate_limiter or RateLimiter()
        self._now = now

    # ------------------------- internals -----------------------------------

    def _age_seconds(self, fetched_at: datetime) -> float:
        """Return elapsed seconds since `fetched_at` per the injected clock."""
        return (self._now() - fetched_at).total_seconds()

    def _is_fresh(self, fetched_at: datetime) -> bool:
        """Return True if the cache entry is within the max age window."""
        return self._age_seconds(fetched_at) < self._max_age.total_seconds()

    # ------------------------- public API ----------------------------------

    def get_tle(self, norad_id: int) -> tuple[TLE, float]:
        """Return `(tle, age_in_seconds)` for a single NORAD ID."""
        cached = self._cache.load_single(norad_id)
        if cached is not None and self._is_fresh(cached[1]):
            return cached[0], self._age_seconds(cached[1])

        self._rate_limiter.wait_if_needed()
        try:
            fresh_list = self._client.fetch_single(norad_id=norad_id)
        except Exception:
            if cached is not None:
                return cached[0], self._age_seconds(cached[1])
            raise
        fresh = fresh_list[0]
        fetched_at = self._now()
        self._cache.save_single(fresh, fetched_at=fetched_at)
        return fresh, 0.0

    def get_group_tles(self, group: str) -> tuple[list[TLE], float]:
        """Return `(tles, age_in_seconds)` for a Celestrak group."""
        cached = self._cache.load_group(group)
        if cached is not None and self._is_fresh(cached[1]):
            return cached[0], self._age_seconds(cached[1])

        self._rate_limiter.wait_if_needed()
        try:
            fresh = self._client.fetch_group(group)
        except Exception:
            if cached is not None:
                return cached[0], self._age_seconds(cached[1])
            raise
        fetched_at = self._now()
        self._cache.save_group(group, fresh, fetched_at=fetched_at)
        return fresh, 0.0
