"""Disk cache for TLE fetches.

Layout under `root`:
    <root>/tle-cache/
        single/<norad_id>.json         # { fetched_at, tle: {...} }
        group/<group_name>.json        # { fetched_at, tles: [{...}, ...] }

Records are self-describing JSON so they survive schema changes as long as
the fields we read remain compatible.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from core._types import TLE


def _tle_to_dict(tle: TLE) -> dict:
    """Serialize a TLE dataclass to a plain dict."""
    return {
        "norad_id": tle.norad_id,
        "name": tle.name,
        "line1": tle.line1,
        "line2": tle.line2,
        "epoch": tle.epoch.isoformat(),
    }


def _tle_from_dict(d: dict) -> TLE:
    """Deserialize a plain dict to a TLE dataclass."""
    return TLE(
        norad_id=int(d["norad_id"]),
        name=d["name"],
        line1=d["line1"],
        line2=d["line2"],
        epoch=datetime.fromisoformat(d["epoch"]),
    )


class TLECache:
    """Append/replace-only cache of TLEs keyed by NORAD ID or group name."""

    def __init__(self, *, root: Path | str) -> None:
        """Initialize the cache, creating subdirectories as needed.

        Args:
            root: Base directory under which `tle-cache/` is created.
        """
        self._root = Path(root) / "tle-cache"
        (self._root / "single").mkdir(parents=True, exist_ok=True)
        (self._root / "group").mkdir(parents=True, exist_ok=True)

    def _single_path(self, norad_id: int) -> Path:
        """Return the file path for a single-satellite cache entry."""
        return self._root / "single" / f"{norad_id}.json"

    def _group_path(self, group: str) -> Path:
        """Return the file path for a group cache entry, sanitizing slashes."""
        safe = group.replace("/", "_")
        return self._root / "group" / f"{safe}.json"

    def save_single(self, tle: TLE, *, fetched_at: datetime) -> None:
        """Write a single TLE record to disk.

        Args:
            tle: The TLE to cache.
            fetched_at: UTC timestamp when the TLE was fetched.
        """
        record = {"fetched_at": fetched_at.isoformat(), "tle": _tle_to_dict(tle)}
        self._single_path(tle.norad_id).write_text(json.dumps(record, indent=2))

    def save_group(self, group: str, tles: list[TLE], *, fetched_at: datetime) -> None:
        """Write a group of TLE records to disk.

        Args:
            group: Group name (e.g. "stations", "starlink").
            tles: List of TLEs belonging to the group.
            fetched_at: UTC timestamp when the TLEs were fetched.
        """
        record = {
            "fetched_at": fetched_at.isoformat(),
            "tles": [_tle_to_dict(t) for t in tles],
        }
        self._group_path(group).write_text(json.dumps(record, indent=2))

    def load_single(self, norad_id: int) -> Optional[tuple[TLE, datetime]]:
        """Load a cached TLE by NORAD ID.

        Returns:
            (TLE, fetched_at) tuple, or None if not cached.
        """
        path = self._single_path(norad_id)
        if not path.exists():
            return None
        record = json.loads(path.read_text())
        return _tle_from_dict(record["tle"]), datetime.fromisoformat(record["fetched_at"])

    def load_group(self, group: str) -> Optional[tuple[list[TLE], datetime]]:
        """Load a cached group of TLEs by group name.

        Returns:
            (list[TLE], fetched_at) tuple, or None if not cached.
        """
        path = self._group_path(group)
        if not path.exists():
            return None
        record = json.loads(path.read_text())
        tles = [_tle_from_dict(d) for d in record["tles"]]
        return tles, datetime.fromisoformat(record["fetched_at"])
