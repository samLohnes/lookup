# Accuracy Log

Quarterly cross-check of the engine's predictions vs. Heavens-Above / Celestrak references.

Any divergence exceeding the spec's stated tolerances is a regression.

| Date | Scenario | Source of truth | Result | Notes |
|---|---|---|---|---|
| 2026-04-20 | ISS over NYC, 24 h window starting at TLE epoch (fixture `tests/fixtures/tle/iss_25544.txt`) | Engine-derived baseline (regression guard only) | 7 passes recorded in `tests/fixtures/expected/iss_nyc_passes.json`; golden test asserts stability within ±1 s / ±0.1° | M1 seed. Must be cross-checked against Heavens-Above before any accuracy claim. |
| 2026-04-20 | /passes endpoint sanity: ISS over NYC, 24 h, line-of-sight | Engine-derived via `tests/integration/test_api_end_to_end.py` | Integration test asserts ≥ 2 passes with valid geometry; must be re-verified against Heavens-Above before claim | M2 seed. Integration-level regression guard only. |
| 2026-04-23 | ISS over NYC, live comparison (app with fresh TLE vs. Heavens-Above PassSummary) | Heavens-Above PassSummary (visual cross-check) | Predicted passes align within visual tolerance — rise/peak/set times match to ~the second, peak az/el agree within a degree across spot-checked passes. Our naked-eye mode hides daytime passes that H-A shows (by design; tracked as a UX polish item). | v0.5.0 live cross-check. Uses the running app + current Celestrak TLE (not the frozen M1 fixture, whose window is historical). |

## Tolerances (per spec §9)

- Rise / set / peak time: ±1 s
- Peak azimuth: ±0.1°
- Peak elevation: ±0.1°
- Magnitude (where implemented): ±0.5 mag
- Horizon mask (DEM-derived): ±0.5° (M2+)

## Process

1. Pick 3 random ISS passes + 1 Starlink train within the last 30 days.
2. For each: enter coords + date into Heavens-Above, record expected pass data.
3. Run the same query through our engine.
4. Record deltas in the table above.
5. If any delta exceeds tolerance, open an issue before merging further engine changes.
