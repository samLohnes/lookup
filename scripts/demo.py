"""M1 demo — predict ISS passes over NYC for the next 24h and print them.

Usage:
    python scripts/demo.py
    python scripts/demo.py --lat 51.5 --lng -0.12 --name London

This uses the committed fixture TLE, so it works offline and doesn't
depend on M2's live Celestrak fetcher.
"""
from __future__ import annotations

import argparse
import sys
from datetime import timedelta, timezone
from pathlib import Path

from skyfield.api import load

from core._types import Observer
from core.catalog.tle_parser import parse_tle_file
from core.orbital.passes import predict_passes
from core.visibility.filter import filter_passes

FIXTURE_TLE = Path(__file__).resolve().parents[1] / "tests" / "fixtures" / "tle" / "iss_25544.txt"


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--lat", type=float, default=40.7128)
    p.add_argument("--lng", type=float, default=-74.0060)
    p.add_argument("--name", default="NYC")
    p.add_argument("--hours", type=int, default=24)
    p.add_argument(
        "--mode",
        choices=["line-of-sight", "naked-eye"],
        default="line-of-sight",
    )
    args = p.parse_args()

    observer = Observer(lat=args.lat, lng=args.lng, elevation_m=10.0, name=args.name)
    tle = parse_tle_file(FIXTURE_TLE)

    ts = load.timescale()
    eph = load("de421.bsp")

    start = tle.epoch.astimezone(timezone.utc)
    end = start + timedelta(hours=args.hours)

    print(f"ISS passes over {observer.name} from {start.isoformat()} to {end.isoformat()}")
    print(f"(TLE epoch {tle.epoch.isoformat()})")
    print()

    passes = predict_passes(tle, observer, start, end, timescale=ts)

    if args.mode == "naked-eye":
        passes = filter_passes(
            passes, tle, observer,
            mode="naked-eye", timescale=ts, ephemeris=eph,
        )
        print(f"Found {len(passes)} naked-eye pass(es):")
    else:
        print(f"Found {len(passes)} pass(es) (line-of-sight):")

    for i, pa in enumerate(passes, 1):
        mag = f" mag {pa.max_magnitude:+.1f}" if pa.max_magnitude is not None else ""
        print(
            f"  {i:2d}. {pa.rise.time.strftime('%Y-%m-%d %H:%M:%S')} UTC  "
            f"peak {pa.peak.position.elevation_deg:4.1f}° az {pa.peak.position.azimuth_deg:5.1f}°  "
            f"dur {pa.duration_s:3d}s{mag}"
        )

    return 0


if __name__ == "__main__":
    sys.exit(main())
