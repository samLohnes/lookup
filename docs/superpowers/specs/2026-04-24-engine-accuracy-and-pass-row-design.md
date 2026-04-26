# Engine Accuracy & Pass-Row Truthfulness Design

**Status:** Drafted 2026-04-24. Follows config-chips + passes-panel redesign (v0.7.x track).

**Goal:** Restore the engine's "research-grade ±1 s / ±0.1°" claim by adding atmospheric refraction at low elevation and per-satellite intrinsic magnitudes (Mike McCants' `qsmag` database, bundled). At the same time, fill in the three hardcoded `"—"` placeholders in the expanded pass row (Visible / Range peak / Angular speed) with values derived from existing computations. Re-baseline the golden fixture and record a formal Heavens-Above cross-check in `accuracy-log.md`.

**Architecture:** Three coordinated changes ship in one spec because they all force a single regeneration of the M1 golden fixture. Refraction is applied two ways — as a horizon-depression offset to skyfield's `find_events` (so rise/set times are *apparent*-horizon, not geometric), and as `pressure_mbar` / `temperature_C` arguments to `topocentric.altaz()` (so reported elevations are refracted). The qsmag database lands as a bundled text file at `core/visibility/data/qsmag.dat`, parsed lazily into a module-level lookup keyed by NORAD ID, with `DEFAULT_INTRINSIC_MAGNITUDE` as the fallback. The three new pass fields (`naked_eye_visible`, `peak.range_km`, `peak.angular_speed_deg_s`) are populated from data the engine already computes during pass detection and track sampling — no new physics.

**Tech Stack:** Python 3.12, skyfield, numpy. Pydantic for response schemas. React 19 + Tailwind on the frontend (UI edit only). No new dependencies.

---

## 1. Context

The README describes the engine as "accurate to ±1 s / ±0.1° against Heavens-Above." Two concrete gaps undermine that claim today:

1. **No atmospheric refraction.** [`core/orbital/tracking.py:91`](../../core/orbital/tracking.py) and [`core/orbital/passes.py:36`](../../core/orbital/passes.py) call skyfield's `topocentric.altaz()` with no `pressure_mbar` or `temperature_C`, so reported altitudes are geometric. Refraction lifts apparent altitude by ~34′ at the horizon and ~5′ at 10° elevation. For passes peaking below ~10°, the ±0.1° elevation tolerance is violated; rise/set times are off by tens of seconds. [`core/orbital/passes.py:89`](../../core/orbital/passes.py) calls `find_events(altitude_degrees=min_elevation_deg)`, which finds *geometric* horizon crossings — apparent rise happens earlier and set later.

2. **Hardcoded ISS magnitude for all single-satellite queries.** [`core/visibility/magnitude.py:18-19`](../../core/visibility/magnitude.py) defines `ISS_INTRINSIC_MAGNITUDE = -1.3` and `DEFAULT_INTRINSIC_MAGNITUDE = 4.0`, but [`core/orbital/tracking.py:55`](../../core/orbital/tracking.py) defaults `sample_track`'s `intrinsic_magnitude` to **ISS**. The `/sky-track` route [(`api/routes/sky_track.py:42`)](../../api/routes/sky_track.py) inherits that default, so Hubble, Starlink, NOAA, anything queried as a single sat without an explicit override gets ISS brightness. This skews the naked-eye magnitude filter.

Separately, the expanded pass row in [`web/src/components/cinematic/passes-panel/pass-row-expanded.tsx`](../../web/src/components/cinematic/passes-panel/pass-row-expanded.tsx) has three hardcoded `"—"` placeholders (lines 80, 85, 86) for Visible / Range peak / Angular speed. The data needed for all three is already computed in `sample_track` and at pass detection — only schema plumbing and a small new helper for angular speed are missing.

The `accuracy-log.md` records a 2026-04-23 v0.5.0 visual cross-check against Heavens-Above ("times match to ~the second, az/el within a degree"), but the M1 fixture itself was never validated with tabulated numeric deltas.

---

## 2. Goals & Non-Goals

### 2.1 Goals

1. **Apply atmospheric refraction** to all observer-relative altitudes reported by the engine. Use sea-level standard pressure (1010 mbar) and 10°C as constants.
2. **Apply horizon-depression offset** to `find_events` so rise/set times are *apparent*-horizon crossings (~−34′ depression).
3. **Bundle Mike McCants' `qsmag` database** at `core/visibility/data/qsmag.dat`. Parse lazily; look up by NORAD ID.
4. **Per-satellite intrinsic magnitude** in `sample_track` and pass-detection magnitude paths. Default behavior changes from "always ISS" to "lookup by NORAD ID, fall back to `DEFAULT_INTRINSIC_MAGNITUDE`".
5. **Add three fields to `Pass` / `PassItem`:** `peak.range_km: float`, `peak.angular_speed_deg_s: float`, `naked_eye_visible: Literal["yes","no","partial"] | None`.
6. **Wire those three fields into the expanded pass row** UI, replacing the three `"—"` strings.
7. **Re-baseline the M1 golden fixture** (`tests/fixtures/expected/iss_nyc_passes.json`). Document why it changed in `accuracy-log.md`.
8. **Record a formal Heavens-Above cross-check** with numeric deltas: 3 ISS passes (NYC + 2 other sites) + 1 Starlink train. New row in `accuracy-log.md`.
9. **Add a `just update-qsmag` Justfile recipe** that fetches and refreshes the bundled snapshot.

### 2.2 Non-goals

- **Magnitude time-series telemetry.** Only peak magnitude in the pass row; the photo-planning card task (separate) handles per-sample magnitude curves.
- **Observer-elevation-aware barometric correction.** Standard sea-level constants are sufficient for ±0.1°.
- **Phase-angle 179.9° clamp change.** Earth-shadow detection (`is_sunlit`) already filters phase ≈ 180° geometry to `magnitude=None`; the clamp is defensive and unobserved as a real-world issue.
- **No external runtime API for magnitudes.** qsmag is bundled and refreshed manually, like `de421.bsp`.
- **Backwards-compatibility shims.** The new `Pass` fields are required, not optional. Callers update.
- **Backfilling `is_sunlit` per-sample for the new `naked_eye_visible` field on group passes.** Group passes return `naked_eye_visible: None` and the UI keeps showing `"—"` for them, matching existing handling of `sunlit_fraction`.
- **Refraction in `darkness.py` (sun altitude).** Civil-twilight thresholds are defined geometrically; refraction would shift twilight onset by ~minutes if applied, breaking convention.

---

## 3. Refraction

### 3.1 Where it applies

Two distinct mechanisms:

**A. `topocentric.altaz(pressure_mbar=1010, temperature_C=10)`** — affects the reported alt/az numbers. Touches:

- `core/orbital/passes.py:36` — `_observe_altaz` (used for rise/peak/set positions reported on `Pass`)
- `core/orbital/tracking.py:91` — `sample_track`'s per-sample observer-relative geometry

**B. `find_events(altitude_degrees=min_elevation_deg - 0.5667)`** — shifts rise/set time detection so events fire at the *apparent* horizon (the standard ~34′ horizon depression):

- `core/orbital/passes.py:89` — single call site

### 3.2 Constants

```python
# core/orbital/refraction.py (new module)
STANDARD_PRESSURE_MBAR = 1010.0
STANDARD_TEMPERATURE_C = 10.0
HORIZON_REFRACTION_DEG = 0.5667  # ~34 arc-minutes at the horizon
```

The horizon refraction value is the IAU/USNO standard for sunrise/sunset and applies equally to satellites near the horizon.

### 3.3 Peak time semantics

`find_events` reports culmination at the geometric maximum altitude. Refraction is a smooth monotone-decreasing function of altitude near peak, so applying refraction shifts peak altitude by a sub-arcminute amount at high peak elevations and shifts the *apparent* peak time by a sub-second amount. **Peak time stays as reported by `find_events`**; only peak alt/az are refraction-corrected via the `altaz()` call.

### 3.4 Effect on existing passes

Expected magnitudes of change after refraction lands:

| Geometric peak el | Apparent peak el shift | Rise/set time shift |
|---|---|---|
| < 5° | +5′ to +30′ | +10s to +30s |
| 5–10° | +5′ to +10′ | +5s to +15s |
| 10–30° | +1′ to +5′ | +2s to +5s |
| 30–60° | < +1′ | < +1s |
| > 60° | sub-arcminute | sub-second |

The M1 golden fixture's seven ISS passes will shift accordingly. Sub-second shifts on overhead passes; tens-of-seconds shifts on low passes.

---

## 4. qsmag database & per-satellite magnitudes

### 4.1 Source

Mike McCants' `qsmag.dat` from `https://mmccants.org/programs/qsmag.zip`. Plain-text file; ~600 entries; NORAD ID + standard magnitude at 1000 km / 50% illumination. The de facto amateur-observation standard since the 1990s, used by Heavens-Above and most amateur tools.

### 4.2 Bundling

- File path: `core/visibility/data/qsmag.dat`
- Committed to the repo as data (~25 KB). Same posture as `de421.bsp`.
- Refreshed manually via `just update-qsmag` (curl + unzip + replace + commit).
- README "Project layout" gets one line under `core/visibility/`.

### 4.3 Module shape

```python
# core/visibility/qsmag.py

def intrinsic_magnitude_for(norad_id: int) -> float:
    """Return McCants standard magnitude for `norad_id`, or DEFAULT_INTRINSIC_MAGNITUDE."""
```

Internal: lazy parse on first call, cache in module-level `dict[int, float]`. Format details (parsing) live inside this module — no per-line schema spilling out.

### 4.4 Plumbing

- `core/orbital/tracking.py:55` — drop the `intrinsic_magnitude: float = ISS_INTRINSIC_MAGNITUDE` parameter from `sample_track`. Replace with internal call: `intrinsic = intrinsic_magnitude_for(tle.norad_id)`. The function now derives intrinsic magnitude from the TLE it already accepts.
- `api/routes/sky_track.py:42` and `core/visibility/filter.py:58` — no source change needed; both call `sample_track` without an override today and inherit the new (correct) behavior automatically.
- `ISS_INTRINSIC_MAGNITUDE` constant stays defined in `magnitude.py` for explicit tests but is no longer the runtime default. Verify by NORAD lookup that qsmag's value for ISS (25544) is close to -1.3.

### 4.5 Effect on existing tests

- `tests/unit/test_magnitude.py:52` (`test_iss_intrinsic_magnitude_constant`) keeps passing — the constant still exists.
- `tests/unit/test_magnitude.py:17` may need adjustment if it relied on `ISS_INTRINSIC_MAGNITUDE` being the default.
- ISS magnitudes in the golden fixture may shift by tenths of a magnitude (qsmag's ISS entry is similar but not identical to the hardcoded -1.3).

---

## 5. New `Pass` / `PassItem` fields

### 5.1 `range_km` on every `PassEndpoint`

Observer-to-satellite distance, in km, at rise / peak / set.

- **Computed at:** Pass detection time. `_observe_altaz` in `passes.py` is extended to return `(AngularPosition, range_km)`; `PassEndpoint.range_km` is populated for all three endpoints. `AngularPosition` stays angle-only.
- **Schema:** `core/_types.py` — extend `PassEndpoint` with `range_km: float`. All three endpoints get it (cheap; it's already part of `topocentric.altaz()`'s return).
- **API:** `api/schemas/responses.py` — endpoint response type gains `range_km: float`.
- **UI:** Only `peak.range_km` rendered in the expanded pass row for now. Rise/set range available for future use without further schema work.

### 5.2 `peak.angular_speed_deg_s: float`

Angular speed of the satellite across the celestial sphere at peak, in degrees per second. Defined as great-circle angular distance between two extra positions sampled at peak − 1 s and peak + 1 s, divided by 2 s.

- **Computed at:** Pass detection. After `find_events` reports culmination, two extra `_observe_altaz` calls bracket the peak time. Adds 2 SGP4 propagations per pass (negligible cost).
- **Helper:** new `core/orbital/angular.py` with `angular_distance_deg(az1, el1, az2, el2) -> float`. Uses spherical-triangle formula (not naive az-el subtraction; near zenith, az differences inflate).
- **Schema:** `Pass.peak.angular_speed_deg_s: float` (lives on the peak `PassEndpoint`).

### 5.3 `naked_eye_visible: Literal["yes","no","partial"] | None`

Per-pass three-state classification.

- `"yes"` — sun illuminates the satellite AND observer is in darkness at all three rise/peak/set sample points
- `"no"` — neither holds at any of the three
- `"partial"` — mixed across the three
- `None` — group passes (`kind != "single"`); UI keeps showing `"—"` for them, matching existing `sunlit_fraction` behavior.

- **Computed at:** `predict_passes`. Three new `is_sunlit(satellite, t)` + `is_observer_in_darkness(t, observer, ...)` calls per pass at rise/peak/set times. Cheap (≈3 sun-position computations; far cheaper than `filter.py`'s dense sampling).
- **Decoupling from visibility mode:** This classification runs in *both* line-of-sight and naked-eye modes, so the UI can render `Visible: yes/no/partial` regardless of which filter mode produced the pass. `filter.py` continues to do its denser sampling for `max_magnitude` and `sunlit_fraction` and may use `pass.naked_eye_visible == "no"` as an early-skip when mode is naked-eye.
- **Schema:** `Pass.naked_eye_visible: Literal["yes","no","partial"] | None`.
- **Heuristic caveat:** A pass with sunlit-failure at rise/peak/set but a brief sunlit window in between will be classified `"no"`. For typical satellite passes (smooth lighting transitions), this is acceptable. If a future user complaint surfaces this edge case, switch to dense sampling.

---

## 6. UI changes

Single file edit: `web/src/components/cinematic/passes-panel/pass-row-expanded.tsx`.

```tsx
// line 80, replacing v="—":
<KV
  k="Visible"
  v={
    pass.kind !== "single" || pass.naked_eye_visible === null
      ? "—"
      : pass.naked_eye_visible
  }
/>

// line 85, replacing v="—":
<KV
  k="Range peak"
  v={`${pass.peak.range_km.toFixed(0)} km`}
/>

// line 86, replacing v="—":
<KV
  k="Ang. speed"
  v={`${pass.peak.angular_speed_deg_s.toFixed(2)}°/s`}
/>
```

`Section` and `KV` primitives unchanged. No new components, no layout shift.

The `web/src/types/api.ts` `PassItem` type gains the three new fields.

---

## 7. Testing strategy

### 7.1 Unit tests (new, TDD)

- `tests/unit/test_qsmag.py` — file parsing, lookup hit (e.g., ISS NORAD 25544), lookup miss → DEFAULT, malformed line tolerance.
- `tests/unit/test_refraction.py` — refracted alt > geometric for el < 30°; equal at zenith; horizon-depression constant matches USNO standard.
- `tests/unit/test_angular_speed.py` — synthetic samples, known angular separation, expected deg/s.
- `tests/unit/test_naked_eye_visible.py` — three-state logic on synthetic sample arrays.

### 7.2 Existing test updates

- `tests/unit/test_magnitude.py` — `intrinsic_magnitude` parameter changes; assert qsmag-driven default.
- `tests/golden/test_iss_nyc.py` — fixture regenerated (see §7.3).
- `tests/api_unit/` — assert presence and types of new fields in `/passes` and `/sky-track` responses.
- `tests/integration/test_api_end_to_end.py` — the existing "≥ 2 passes with valid geometry" assertion still holds; add assertions for new fields.

### 7.3 Golden fixture re-baseline

The M1 golden fixture is the engine's regression guard. Refraction will shift its values. Process:

1. Implement all engine changes (refraction + qsmag + new fields).
2. Run the regeneration script (existing in `tests/golden/`).
3. Diff the new fixture against the old — expected: rise/set times shift seconds, peak el shifts arcminutes on low passes, magnitude shifts tenths if qsmag's ISS entry differs from -1.3, three new fields appear.
4. Eyeball the diff for sanity. If anything moves more than the §3.4 table predicts, investigate before committing.
5. Commit the new fixture in the same PR. `accuracy-log.md` gets a row noting the deliberate re-baseline and the reason.

### 7.4 Frontend tests

- `pass-row-expanded.test.tsx` — extend existing tests to assert the three new field renders and the group-pass `"—"` fallback for `Visible`.

---

## 8. Heavens-Above cross-check

A formal cross-check is part of this spec — without it, the M1 baseline rests only on the soft v0.5.0 visual check.

Per the documented process at the bottom of `accuracy-log.md`:

1. Pick **3 ISS passes** within the last 14 days from three locations:
   - NYC (40.71°N, 74.01°W) — same as M1
   - One mid-latitude (e.g., London, 51.51°N, 0.13°W)
   - One high-latitude (e.g., Reykjavík, 64.13°N, 21.94°W) — to stress the geodetic/refraction story
2. Pick **1 Starlink train** pass from any one of those locations.
3. For each: enter coords + date into Heavens-Above, record expected rise/peak/set times, peak az/el, peak magnitude.
4. Run the same query through the engine.
5. Tabulate numeric deltas in a new `accuracy-log.md` row, dated, with a free-form notes column for any out-of-tolerance cases.

If any delta exceeds the §13 spec tolerances (±1 s / ±0.1° / ±0.5 mag), do not merge. Investigate.

---

## 9. Files touched

**New:**

- `core/orbital/refraction.py` — constants for pressure, temperature, horizon depression
- `core/visibility/qsmag.py` — parser + lookup
- `core/visibility/data/qsmag.dat` — bundled snapshot
- `core/orbital/angular.py` — great-circle angular distance helper
- `tests/unit/test_qsmag.py`
- `tests/unit/test_refraction.py`
- `tests/unit/test_angular_speed.py`
- `tests/unit/test_naked_eye_visible.py`

**Modified:**

- `core/_types.py` — extend `PassEndpoint` (add `range_km`), extend `Pass` (add `naked_eye_visible`, ensure `peak.angular_speed_deg_s`)
- `core/orbital/passes.py` — refraction in `_observe_altaz`, horizon depression in `find_events`, populate `range_km` and `angular_speed_deg_s`
- `core/orbital/tracking.py` — refraction in `altaz()`, qsmag-driven intrinsic magnitude, drop `intrinsic_magnitude` parameter
- `core/visibility/filter.py` — qsmag-driven intrinsic magnitude, populate `naked_eye_visible`
- `core/visibility/magnitude.py` — keep constants; no behavioral change
- `api/routes/sky_track.py` — drop `intrinsic_magnitude` override
- `api/schemas/responses.py` — extend response types with three new fields
- `tests/fixtures/expected/iss_nyc_passes.json` — regenerated
- `tests/golden/test_iss_nyc.py` — pointer updates if needed
- `tests/unit/test_magnitude.py` — adjust intrinsic-magnitude default tests
- `tests/api_unit/` — assert new fields
- `tests/integration/test_api_end_to_end.py` — assert new fields
- `web/src/types/api.ts` — extend `PassItem`
- `web/src/components/cinematic/passes-panel/pass-row-expanded.tsx` — wire three new fields
- `web/src/components/cinematic/passes-panel/pass-row-expanded.test.tsx` — extend
- `Justfile` — add `update-qsmag` recipe
- `docs/accuracy-log.md` — re-baseline note + new H-A cross-check row
- `README.md` — one-line note on bundled magnitude database under "Project layout"

---

## 10. Tolerances (unchanged from spec §13)

After this work lands, all of the following must hold against Heavens-Above:

- Rise / set / peak time: ±1 s
- Peak azimuth: ±0.1°
- Peak elevation: ±0.1°
- Magnitude: ±0.5 mag
- Horizon mask (DEM-derived): ±0.5°

---

## 11. Open questions

None at draft time. All design decisions resolved during brainstorming.
