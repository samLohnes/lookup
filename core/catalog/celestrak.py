"""Thin Celestrak GP-API client.

Returns `TLE` objects parsed from Celestrak's 3LE (three-line element) text
responses. No caching, no retry, no rate-limiting — those belong to the
orchestrator in `core.catalog.fetcher`.

3LE rather than JSON: Celestrak's JSON response format returns Keplerian
orbital elements (INCLINATION, MEAN_MOTION, etc.) without the raw TLE text
lines. Our engine consumes TLE text, so we ask Celestrak for it directly.
"""
from __future__ import annotations

from typing import Optional

import httpx

from core._types import TLE
from core.catalog.tle_parser import parse_tle

CELESTRAK_BASE_URL = "https://celestrak.org/NORAD/elements/gp.php"
DEFAULT_TIMEOUT_S = 15.0


class CelestrakError(RuntimeError):
    """Raised when a Celestrak fetch fails or returns no usable data."""


def celestrak_url(
    *,
    norad_id: Optional[int] = None,
    group: Optional[str] = None,
    base_url: str = CELESTRAK_BASE_URL,
) -> str:
    """Build a Celestrak GP URL for either a single NORAD ID or a group.

    Uses `FORMAT=3LE`, which returns name + line1 + line2 per object.

    Raises:
        ValueError: if both or neither of `norad_id`/`group` are given.
    """
    if (norad_id is None) == (group is None):
        raise ValueError("must specify exactly one of norad_id or group")
    if norad_id is not None:
        return f"{base_url}?CATNR={int(norad_id)}&FORMAT=3LE"
    return f"{base_url}?GROUP={group}&FORMAT=3LE"


def _parse_3le_text(text: str) -> list[TLE]:
    """Parse a Celestrak 3LE response into a list of `TLE`.

    Each satellite occupies three non-blank lines: name, line1, line2.
    The name line in 3LE format may optionally start with '0 ' (prefix
    that marks it as the name record) — we strip that to get the bare name.
    """
    lines = [ln.rstrip() for ln in text.splitlines() if ln.strip()]
    if len(lines) == 0:
        return []
    if len(lines) % 3 != 0:
        raise CelestrakError(
            f"unexpected 3LE response — {len(lines)} non-blank lines is not a multiple of 3"
        )
    out: list[TLE] = []
    for i in range(0, len(lines), 3):
        name_line = lines[i]
        # Strip optional "0 " prefix that marks name records in 3LE.
        name = name_line[2:] if name_line.startswith("0 ") else name_line
        out.append(parse_tle(line1=lines[i + 1], line2=lines[i + 2], name=name))
    return out


class CelestrakClient:
    """Thin HTTP client returning parsed TLEs from Celestrak's 3LE endpoint."""

    def __init__(
        self,
        *,
        base_url: str = CELESTRAK_BASE_URL,
        timeout_s: float = DEFAULT_TIMEOUT_S,
        transport: Optional[httpx.BaseTransport] = None,
    ) -> None:
        self._base_url = base_url
        self._client = httpx.Client(timeout=timeout_s, transport=transport)

    def _get_text(self, url: str) -> str:
        try:
            response = self._client.get(url)
        except httpx.HTTPError as exc:
            raise CelestrakError(f"network error: {exc}") from exc
        if response.status_code != 200:
            raise CelestrakError(
                f"HTTP {response.status_code} from Celestrak: {response.text[:200]}"
            )
        return response.text

    def fetch_single(self, *, norad_id: int) -> list[TLE]:
        """Fetch the TLE for one NORAD ID (wrapped in a single-element list)."""
        url = celestrak_url(norad_id=norad_id, base_url=self._base_url)
        tles = _parse_3le_text(self._get_text(url))
        if not tles:
            raise CelestrakError(f"Celestrak returned no results for NORAD {norad_id}")
        return tles

    def fetch_group(self, group: str) -> list[TLE]:
        """Fetch all TLEs in a named Celestrak group (e.g. 'stations')."""
        url = celestrak_url(group=group, base_url=self._base_url)
        tles = _parse_3le_text(self._get_text(url))
        if not tles:
            raise CelestrakError(f"Celestrak returned no results for group {group!r}")
        return tles

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self._client.close()

    def __enter__(self) -> "CelestrakClient":
        """Enter context manager."""
        return self

    def __exit__(self, *exc_info) -> None:
        """Exit context manager and close the client."""
        self.close()
