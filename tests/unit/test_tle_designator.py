"""Tests for core.catalog.tle_designator."""
from __future__ import annotations

from core.catalog.tle_designator import parse_designator

# A real TLE line 1 (ISS, NORAD 25544). International designator at cols 10-17.
ISS_LINE1 = "1 25544U 98067A   25024.50000000  .00012345  00000-0  12345-3 0  9999"

# Line 1 shape variants for the designator slice.
def _line1_with_designator(designator: str) -> str:
    """Build a synthetic line 1 where cols 10-17 are the given 8-char designator."""
    padded = designator.ljust(8)[:8]
    return f"1 12345U {padded} 25024.50000000  .00012345  00000-0  12345-3 0  9999"


def test_iss_designator():
    assert parse_designator(ISS_LINE1) == (1998, 67, "A")


def test_modern_starlink_designator():
    line1 = _line1_with_designator("25024A  ")
    assert parse_designator(line1) == (2025, 24, "A")


def test_year_boundary_56_is_2056():
    line1 = _line1_with_designator("56001A  ")
    assert parse_designator(line1) == (2056, 1, "A")


def test_year_boundary_57_is_1957():
    line1 = _line1_with_designator("57001A  ")
    assert parse_designator(line1) == (1957, 1, "A")


def test_three_letter_piece():
    line1 = _line1_with_designator("25024ABC")
    assert parse_designator(line1) == (2025, 24, "ABC")


def test_line_too_short_returns_none():
    assert parse_designator("1 25544U") is None
    assert parse_designator("") is None


def test_non_digit_year_returns_none():
    line1 = _line1_with_designator("XX024A  ")
    assert parse_designator(line1) is None


def test_non_digit_launch_number_returns_none():
    line1 = _line1_with_designator("25XXXA  ")
    assert parse_designator(line1) is None


def test_same_launch_same_key():
    """All sats from one launch share (year, launch_number) — used for grouping."""
    a = parse_designator(_line1_with_designator("25024A  "))
    b = parse_designator(_line1_with_designator("25024B  "))
    assert a is not None and b is not None
    assert (a[0], a[1]) == (b[0], b[1])
