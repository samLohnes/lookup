"""TLE parsing — converts raw TLE text into `TLE` dataclasses.

TLEs follow a fixed-width ASCII format specified by NORAD. Key columns:
  line1 cols 3–7   : NORAD catalog number
  line1 cols 19–20 : two-digit epoch year (57-99 => 19xx, 00-56 => 20xx)
  line1 cols 21–32 : epoch day-of-year + fractional day
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

from core._types import TLE


def parse_tle(*, line1: str, line2: str, name: str) -> TLE:
    """Parse TLE line1 / line2 / name into a `TLE` dataclass.

    Args:
        line1: The 69-char line 1 of the TLE.
        line2: The 69-char line 2 of the TLE.
        name: The satellite name (often a preceding "0 " line in 3LE format).

    Raises:
        ValueError: If the lines are malformed or their NORAD IDs don't match.
    """
    if not line1.startswith("1 "):
        raise ValueError("line1 must start with '1 '")
    if not line2.startswith("2 "):
        raise ValueError("line2 must start with '2 '")

    norad_1 = int(line1[2:7].strip())
    norad_2 = int(line2[2:7].strip())
    if norad_1 != norad_2:
        raise ValueError(f"NORAD ID mismatch between lines ({norad_1} vs {norad_2})")

    year_2 = int(line1[18:20])
    year = 1900 + year_2 if year_2 >= 57 else 2000 + year_2
    day_frac = float(line1[20:32])
    # day-of-year is 1-indexed; fractional day adds hours/mins/secs
    epoch = datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(days=day_frac - 1)

    return TLE(
        norad_id=norad_1,
        name=name.strip(),
        line1=line1,
        line2=line2,
        epoch=epoch,
    )


def parse_tle_file(path: Path | str) -> TLE:
    """Parse a 3-line TLE file (NAME / LINE1 / LINE2).

    This is the format Celestrak uses by default. Blank lines are ignored.
    """
    raw = Path(path).read_text(encoding="utf-8").splitlines()
    lines = [line.rstrip() for line in raw if line.strip()]
    if len(lines) < 3:
        raise ValueError(
            f"{path}: expected 3 non-empty lines (name, line1, line2), got {len(lines)}"
        )
    name, line1, line2 = lines[0], lines[1], lines[2]
    return parse_tle(line1=line1, line2=line2, name=name)
