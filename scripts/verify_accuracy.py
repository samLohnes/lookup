"""Accuracy verification helper — print the engine's golden-baseline passes
in a format that makes side-by-side Heavens-Above comparison easy.

This script does NOT fetch anything from Heavens-Above (no scraping, no API
call). It just formats what the engine predicts — labeled, with compass
directions and a pre-built Heavens-Above URL — so a human can open the URL
and compare the numbers quickly.

Usage:
    python scripts/verify_accuracy.py

Then open the printed URL, find the matching passes, and record any deltas
in `docs/accuracy-log.md`. Tolerance: ±1 s on times, ±0.1° on azimuth/elevation.
"""
from __future__ import annotations

import json
import sys
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path

from core.catalog.tle_parser import parse_tle_file

REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURE_TLE = REPO_ROOT / "tests" / "fixtures" / "tle" / "iss_25544.txt"
BASELINE = REPO_ROOT / "tests" / "fixtures" / "expected" / "iss_nyc_passes.json"

# Matches the NYC observer used in the golden test.
OBSERVER_NAME = "NYC"
OBSERVER_LAT = 40.7128
OBSERVER_LNG = -74.0060
OBSERVER_ELEVATION_M = 10

_COMPASS_16 = (
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW",
)


def compass_direction(azimuth_deg: float) -> str:
    """Return a 16-point compass label for an azimuth in degrees."""
    i = int((azimuth_deg / 22.5) + 0.5) % 16
    return _COMPASS_16[i]


def heavens_above_url(*, lat: float, lng: float, elevation_m: int, name: str) -> str:
    """Build a Heavens-Above PassSummary URL for ISS at the given observer."""
    params = {
        "satid": 25544,
        "lat": lat,
        "lng": lng,
        "loc": name,
        "alt": elevation_m,
        "tz": "UCT",  # Heavens-Above's token for UTC
    }
    return "https://www.heavens-above.com/PassSummary.aspx?" + urllib.parse.urlencode(params)


def fmt_azel(az_deg: float, el_deg: float) -> str:
    """Pretty-print an (az, el) pair with the compass direction."""
    return f"az {az_deg:6.2f}° ({compass_direction(az_deg):>3})  el {el_deg:5.2f}°"


def main() -> int:
    if not FIXTURE_TLE.exists():
        print(f"error: fixture TLE not found at {FIXTURE_TLE}", file=sys.stderr)
        return 1
    if not BASELINE.exists():
        print(f"error: baseline JSON not found at {BASELINE}", file=sys.stderr)
        return 1

    tle = parse_tle_file(FIXTURE_TLE)
    passes = json.loads(BASELINE.read_text())

    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=24)

    bar = "═" * 72
    sub = "─" * 72

    print(bar)
    print(f"  Accuracy Verification — {tle.name} over {OBSERVER_NAME}")
    print(f"  Fixture: {FIXTURE_TLE.relative_to(REPO_ROOT)}")
    print(bar)
    print()
    fmt = "%Y-%m-%d %H:%M:%S UTC"
    print(f"  TLE epoch:  {tle.epoch.strftime(fmt)}")
    print(f"  Window:     {start.strftime(fmt)}  →  {end.strftime(fmt)}  (24 h)")
    print(f"  Observer:   {OBSERVER_NAME}  {OBSERVER_LAT:.4f}°N, {abs(OBSERVER_LNG):.4f}°W, {OBSERVER_ELEVATION_M} m")
    print()
    print("  Open in a browser to compare:")
    print("  " + heavens_above_url(
        lat=OBSERVER_LAT,
        lng=OBSERVER_LNG,
        elevation_m=OBSERVER_ELEVATION_M,
        name=OBSERVER_NAME,
    ))
    print()
    print("  Tolerance:  ±1 s on times, ±0.1° on azimuth / elevation")
    print(sub)
    print(f"  {len(passes)} pass(es) predicted by the engine — compare in order")
    print(sub)

    for i, p in enumerate(passes, 1):
        rise_t = datetime.fromisoformat(p["rise_utc"])
        peak_t = datetime.fromisoformat(p["peak_utc"])
        set_t = datetime.fromisoformat(p["set_utc"])
        duration = p["duration_s"]

        print()
        print(f"  Pass {i} of {len(passes)}   (duration {duration} s)")
        print(f"    Rise  {rise_t.strftime('%Y-%m-%d %H:%M:%S')} UTC   "
              f"{fmt_azel(p['rise_az'], 0.0).replace('el  0.00°', 'el  (horizon)')}")
        print(f"    Peak  {peak_t.strftime('%Y-%m-%d %H:%M:%S')} UTC   "
              f"{fmt_azel(p['peak_az'], p['peak_el'])}")
        print(f"    Set   { set_t.strftime('%Y-%m-%d %H:%M:%S')} UTC   "
              f"{fmt_azel(p['set_az'], 0.0).replace('el  0.00°', 'el  (horizon)')}")

    print()
    print(sub)
    print("  After comparing, record the result in docs/accuracy-log.md.")
    print("  • Within tolerance → update the M1 seed row to reflect Heavens-Above verification.")
    print("  • Out of tolerance → do NOT silently update. Open an issue and investigate.")
    print(bar)

    return 0


if __name__ == "__main__":
    sys.exit(main())
