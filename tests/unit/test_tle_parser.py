"""Tests for core.catalog.tle_parser."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pytest

from core.catalog.tle_parser import parse_tle, parse_tle_file

FIXTURE_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "tle"


def test_parse_tle_lines():
    name = "ISS (ZARYA)"
    line1 = "1 25544U 98067A   24101.50000000  .00010000  00000-0  18000-3 0  9990"
    line2 = "2 25544  51.6400   0.0000 0001000   0.0000   0.0000 15.50000000 99990"

    tle = parse_tle(line1=line1, line2=line2, name=name)

    assert tle.norad_id == 25544
    assert tle.name == "ISS (ZARYA)"
    assert tle.line1 == line1
    assert tle.line2 == line2

    # Epoch: day-of-year 101 of 2024 (2024-04-10), fraction 0.5 => 12:00 UTC
    expected = datetime(2024, 4, 10, 12, 0, 0, tzinfo=timezone.utc)
    assert tle.epoch == expected


def test_parse_tle_name_is_trimmed():
    line1 = "1 25544U 98067A   24101.50000000  .00010000  00000-0  18000-3 0  9990"
    line2 = "2 25544  51.6400   0.0000 0001000   0.0000   0.0000 15.50000000 99990"
    tle = parse_tle(line1=line1, line2=line2, name="  ISS (ZARYA)   ")
    assert tle.name == "ISS (ZARYA)"


def test_parse_tle_rejects_wrong_line1_prefix():
    line1 = "2 25544U 98067A   24101.50000000  .00010000  00000-0  18000-3 0  9990"
    line2 = "2 25544  51.6400   0.0000 0001000   0.0000   0.0000 15.50000000 99990"
    with pytest.raises(ValueError, match="line1 must start with '1 '"):
        parse_tle(line1=line1, line2=line2, name="X")


def test_parse_tle_rejects_wrong_line2_prefix():
    line1 = "1 25544U 98067A   24101.50000000  .00010000  00000-0  18000-3 0  9990"
    line2 = "1 25544  51.6400   0.0000 0001000   0.0000   0.0000 15.50000000 99990"
    with pytest.raises(ValueError, match="line2 must start with '2 '"):
        parse_tle(line1=line1, line2=line2, name="X")


def test_parse_tle_mismatched_norad_ids():
    line1 = "1 25544U 98067A   24101.50000000  .00010000  00000-0  18000-3 0  9990"
    line2 = "2 99999  51.6400   0.0000 0001000   0.0000   0.0000 15.50000000 99990"
    with pytest.raises(ValueError, match="NORAD ID mismatch"):
        parse_tle(line1=line1, line2=line2, name="X")


def test_parse_tle_epoch_year_rollover_pre_1957():
    """Years 57-99 map to 19xx, 00-56 map to 20xx (Celestrak convention)."""
    # 57001 => 1957-01-01
    line1 = "1 00001U 57001A   57001.00000000  .00000000  00000-0  00000-0 0    1"
    line2 = "2 00001  51.6400   0.0000 0001000   0.0000   0.0000 15.50000000    1"
    tle = parse_tle(line1=line1, line2=line2, name="X")
    assert tle.epoch.year == 1957


def test_parse_tle_file_reads_three_line_format():
    path = FIXTURE_DIR / "iss_25544.txt"
    tle = parse_tle_file(path)
    assert tle.norad_id == 25544
    assert tle.name == "ISS (ZARYA)"
