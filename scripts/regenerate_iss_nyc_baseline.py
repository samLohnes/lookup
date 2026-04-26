"""Regenerate tests/fixtures/expected/iss_nyc_passes.json from the engine.

This is a deliberate operation. Only run it after a code change you've
verified represents an accuracy *improvement* — never to silence a
regression. Always cross-check the new fixture against Heavens-Above
afterwards (see docs/accuracy-log.md process at the bottom).

Usage:
    python scripts/regenerate_iss_nyc_baseline.py
"""
from __future__ import annotations

import json
from datetime import timedelta, timezone
from pathlib import Path

from skyfield.api import load

from core._types import Observer
from core.catalog.tle_parser import parse_tle_file
from core.orbital.passes import predict_passes

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURE_TLE = REPO_ROOT / "tests" / "fixtures" / "tle" / "iss_25544.txt"
BASELINE = REPO_ROOT / "tests" / "fixtures" / "expected" / "iss_nyc_passes.json"

NYC = Observer(lat=40.7128, lng=-74.0060, elevation_m=10.0, name="NYC")


def main() -> int:
    """Regenerate the M1 golden fixture from the current engine."""
    timescale = load.timescale()
    ephemeris = load("de421.bsp")
    tle = parse_tle_file(FIXTURE_TLE)
    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)

    passes = predict_passes(
        tle, NYC, start, end,
        timescale=timescale, ephemeris=ephemeris,
    )

    out = []
    for p in passes:
        out.append({
            "id": p.id,
            "rise_utc": p.rise.time.isoformat(),
            "peak_utc": p.peak.time.isoformat(),
            "set_utc": p.set.time.isoformat(),
            "rise_az": round(p.rise.position.azimuth_deg, 2),
            "peak_az": round(p.peak.position.azimuth_deg, 2),
            "set_az": round(p.set.position.azimuth_deg, 2),
            "peak_el": round(p.peak.position.elevation_deg, 2),
            "duration_s": p.duration_s,
            "rise_range_km": round(p.rise.range_km, 1),
            "peak_range_km": round(p.peak.range_km, 1),
            "set_range_km": round(p.set.range_km, 1),
            "peak_angular_speed_deg_s": round(p.peak_angular_speed_deg_s, 4),
            "naked_eye_visible": p.naked_eye_visible,
        })

    BASELINE.write_text(json.dumps(out, indent=2) + "\n")
    print(f"Wrote {len(out)} pass records to {BASELINE.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
