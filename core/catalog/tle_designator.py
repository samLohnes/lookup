"""Parse the international designator from TLE line 1 (cols 10-17).

Format: YY-NNN-PIECE  →  e.g. line1[9:17] = "25024A  " for the 24th
launch of 2025, piece A.

Used by core/trains/discovery.py to group sats by launch event for
rank-based recency filtering. Day-of-year is NOT available from the
designator — only year and launch sequence — so callers cannot derive
an absolute launch date.
"""
from __future__ import annotations


def parse_designator(line1: str) -> tuple[int, int, str] | None:
    """Parse cols 10-17 of TLE line 1.

    Format: YY-NNN-PIECE — two-digit year, three-digit launch number,
    1-3 char piece. Two-digit year follows skyfield's convention:
    yy < 57 → 20xx, else 19xx.

    Args:
        line1: TLE line 1 string.

    Returns:
        (launch_year_4digit, launch_number, piece) or None if unparseable.
    """
    if len(line1) < 17:
        return None
    raw = line1[9:17]  # 8 chars, 0-indexed slice
    yy_str = raw[:2].strip()
    nnn_str = raw[2:5].strip()
    piece = raw[5:].strip()
    if not (yy_str.isdigit() and nnn_str.isdigit()):
        return None
    yy = int(yy_str)
    year = 2000 + yy if yy < 57 else 1900 + yy
    return year, int(nnn_str), piece
