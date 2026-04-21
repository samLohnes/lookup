"""Thin Celestrak GP-API client.

Returns `TLE` objects parsed from Celestrak's JSON responses. No caching,
no retry, no rate-limiting — those belong to the orchestrator in
`core.catalog.fetcher`.
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

    Raises:
        ValueError: if both or neither of `norad_id`/`group` are given.
    """
    if (norad_id is None) == (group is None):
        raise ValueError("must specify exactly one of norad_id or group")
    if norad_id is not None:
        return f"{base_url}?CATNR={int(norad_id)}&FORMAT=json"
    return f"{base_url}?GROUP={group}&FORMAT=json"


class CelestrakClient:
    """Thin HTTP client returning parsed TLEs."""

    def __init__(
        self,
        *,
        base_url: str = CELESTRAK_BASE_URL,
        timeout_s: float = DEFAULT_TIMEOUT_S,
        transport: Optional[httpx.BaseTransport] = None,
    ) -> None:
        self._base_url = base_url
        self._client = httpx.Client(timeout=timeout_s, transport=transport)

    def _get_json(self, url: str) -> list[dict]:
        """Fetch a URL and return the parsed JSON list.

        Raises:
            CelestrakError: on network errors, non-200 responses, or unexpected payload shape.
        """
        try:
            response = self._client.get(url)
        except httpx.HTTPError as exc:
            raise CelestrakError(f"network error: {exc}") from exc
        if response.status_code != 200:
            raise CelestrakError(
                f"HTTP {response.status_code} from Celestrak: {response.text[:200]}"
            )
        data = response.json()
        if not isinstance(data, list):
            raise CelestrakError(f"unexpected payload shape: {type(data).__name__}")
        return data

    def _parse_rows(self, rows: list[dict]) -> list[TLE]:
        """Convert a list of Celestrak JSON records into `TLE` dataclasses."""
        out: list[TLE] = []
        for row in rows:
            line1 = row["TLE_LINE1"]
            line2 = row["TLE_LINE2"]
            name = row.get("TLE_LINE0") or row["OBJECT_NAME"]
            out.append(parse_tle(line1=line1, line2=line2, name=name))
        return out

    def fetch_single(self, *, norad_id: int) -> list[TLE]:
        """Fetch the TLE for one NORAD ID (wrapped in a single-element list)."""
        url = celestrak_url(norad_id=norad_id, base_url=self._base_url)
        rows = self._get_json(url)
        if not rows:
            raise CelestrakError(f"Celestrak returned no results for NORAD {norad_id}")
        return self._parse_rows(rows)

    def fetch_group(self, group: str) -> list[TLE]:
        """Fetch all TLEs in a named Celestrak group (e.g. 'stations')."""
        url = celestrak_url(group=group, base_url=self._base_url)
        rows = self._get_json(url)
        if not rows:
            raise CelestrakError(f"Celestrak returned no results for group {group!r}")
        return self._parse_rows(rows)

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self._client.close()

    def __enter__(self) -> "CelestrakClient":
        """Enter context manager."""
        return self

    def __exit__(self, *exc_info: object) -> None:
        """Exit context manager, closing the client."""
        self.close()
