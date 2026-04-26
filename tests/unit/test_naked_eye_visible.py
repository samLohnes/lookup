"""naked_eye_visible classifies a pass as yes/no/partial via 3-sample test."""
from __future__ import annotations

from datetime import timedelta, timezone
from pathlib import Path

import pytest

from core._types import Observer
from core.catalog.tle_parser import parse_tle_file
from core.orbital.passes import predict_passes

FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


@pytest.mark.skipif(
    not (FIXTURES / "tle" / "iss_25544.txt").exists(),
    reason="ISS fixture TLE not present",
)
def test_iss_passes_have_classification(timescale, ephemeris):
    tle = parse_tle_file(FIXTURES / "tle" / "iss_25544.txt")
    nyc = Observer(lat=40.7128, lng=-74.0060, elevation_m=10.0)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)
    passes = predict_passes(tle, nyc, start, end, timescale=timescale, ephemeris=ephemeris)
    assert passes
    valid = {"yes", "no", "partial"}
    for p in passes:
        assert p.naked_eye_visible in valid, (
            f"unexpected classification {p.naked_eye_visible!r}"
        )


def test_classification_yes_when_all_sunlit_and_dark(timescale, ephemeris, monkeypatch):
    """Synthetic scenario: stub the helpers so all three points qualify."""
    from core.orbital import passes as passes_module
    monkeypatch.setattr(passes_module, "_is_sunlit_at", lambda *a, **kw: True)
    monkeypatch.setattr(passes_module, "_is_observer_dark_at", lambda *a, **kw: True)

    tle = parse_tle_file(FIXTURES / "tle" / "iss_25544.txt")
    nyc = Observer(lat=40.7128, lng=-74.0060, elevation_m=10.0)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)
    passes = predict_passes(tle, nyc, start, end, timescale=timescale, ephemeris=ephemeris)
    assert passes
    assert all(p.naked_eye_visible == "yes" for p in passes)


def test_classification_no_when_none_qualify(timescale, ephemeris, monkeypatch):
    from core.orbital import passes as passes_module
    monkeypatch.setattr(passes_module, "_is_sunlit_at", lambda *a, **kw: False)
    monkeypatch.setattr(passes_module, "_is_observer_dark_at", lambda *a, **kw: False)

    tle = parse_tle_file(FIXTURES / "tle" / "iss_25544.txt")
    nyc = Observer(lat=40.7128, lng=-74.0060, elevation_m=10.0)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)
    passes = predict_passes(tle, nyc, start, end, timescale=timescale, ephemeris=ephemeris)
    assert passes
    assert all(p.naked_eye_visible == "no" for p in passes)


def test_naked_eye_visible_none_without_ephemeris(timescale):
    """When ephemeris is not provided, classification is left as None."""
    tle = parse_tle_file(FIXTURES / "tle" / "iss_25544.txt")
    nyc = Observer(lat=40.7128, lng=-74.0060, elevation_m=10.0)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)
    passes = predict_passes(tle, nyc, start, end, timescale=timescale)
    assert passes
    assert all(p.naked_eye_visible is None for p in passes)
