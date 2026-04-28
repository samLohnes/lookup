# Follow-ups

Known limitations and engineering tickets that came out of completed work.
One-off bugs go through normal git/PR flow; these are larger gaps that need
a design pass before implementation.

---

## Add train affordances to cinematic pass list

**Surfaced by:** [`feat/engine-accuracy-and-pass-row`](docs/superpowers/specs/2026-04-24-engine-accuracy-and-pass-row-design.md) (merged 2026-04-26).

**Problem.** In
[`web/src/components/cinematic/passes-panel/pass-row.tsx`](../web/src/components/cinematic/passes-panel/pass-row.tsx),
train passes (`kind === "train"`) render exactly like single-satellite
passes — peak time + "rises {compass} · peaks {el}°" — with no visual
indication that it's a train of N satellites. The train's name (e.g.
"STARLINK train (5 objects)") only appears in the expanded body's
"Satellite" KV row, easy to miss.

The older
[`web/src/components/passes/pass-card.tsx`](../web/src/components/passes/pass-card.tsx)
has a small affordance:

```tsx
{pass.kind === "train" && (
  <div className="text-xs text-satellite mt-1">
    {pass.member_count} objects
  </div>
)}
```

The cinematic version doesn't.

**What needs to happen.**

- Add a train indicator to `pass-row.tsx` — at minimum, a "{N} objects"
  badge or icon in the collapsed header so users can tell at a glance.
- Consider showing member NORAD IDs (or first/last range like
  "NORADs 68719-68724") in the expanded view; today only
  `pass.member_norad_ids` is in the schema but never rendered.
- Decide on visual treatment — a small badge near the peak time? An
  icon? Color-coding the row? Bias toward "small, dense, non-distracting"
  since the cinematic view already packs a lot in.

**Useful context.**

- `TrainPassResponse` has: `id`, `name`, `member_norad_ids`,
  `member_count`, `peak.range_km`, `max_magnitude`.
- The expanded row already renders `peak.range_km` for trains (shipped
  in the merged feature branch).
- This is mostly a UX/design question — small visual treatment proposal
  before implementing.

---

## ~~Live satellite position on 3D globe when no pass is selected~~ — shipped 2026-04-28

**Status:** Shipped on `feat/live-globe-position` (2026-04-28). See spec at
[`docs/superpowers/specs/2026-04-27-live-globe-position-design.md`](superpowers/specs/2026-04-27-live-globe-position-design.md).

The original problem statement and design notes below are preserved for
historical reference.

**Surfaced by:** [`feat/passes-panel-redesign`](superpowers/specs/2026-04-24-passes-panel-redesign.md) §2.2 (deferred there as a bundled sky-view + globe live-mode; descoped to globe-only in the 2026-04-27 follow-up review — sky view stays empty when no pass is selected).

**Problem.** In cinematic mode, when no pass is selected, the 3D globe
shows a static earth + observer pin + nothing. The satellite marker
only appears once a pass is selected and the playback cursor is inside
its arc window. The most visually expensive view in the app is doing
the least most of the time the user is on the page.

The earlier deferred writeup bundled this with a sky-view live mode;
that scope is dropped. Sky view stays empty until a pass is selected
(its alt-az frame is meaningless when the satellite is below horizon,
which is most of the time). The globe variant is the interesting one
because the sub-satellite point is always defined.

**What needs to happen.**

- Add a lightweight API endpoint (e.g. `GET /now-position?norad=25544`)
  that returns the current sub-satellite point: `{ lat, lng, alt_km,
  velocity_km_s, t_utc }`. Reuses existing `core/orbital/` propagation
  — no new engine code, just a thin route. Client-side SGP4 is **out
  of scope** — recreating the engine in the browser would duplicate
  truth and divergence is a real risk.
- Add a sibling endpoint or extend the same one to return the recent
  ground track (e.g. `GET /now-track?norad=25544&minutes=10`) returning
  a polyline of sub-satellite points for the trailing window. Could
  also be a single combined call — design choice during implementation.
- Frontend polls `/now-position` at ~1 Hz and re-renders the satellite
  marker at the returned lat/lng/alt. Existing marker mesh + 4× altitude
  exaggeration is reused unchanged.
- **Render a faint trailing ground-track segment** (last ~10 min of
  sub-satellite points) so the marker has visible motion and direction.
  Mandatory, not optional — without it the marker reads as static at
  globe scale.
- When a pass IS selected, the existing pass-arc + playback behavior
  takes over — this is purely a "no pass selected" fallback.
- Trailing track polling can be coarser (e.g. once per 30s, since it
  only adds points to the tail).

**Useful context.**

- Existing satellite-marker code: `web/src/components/earth-view/satellite-marker-mesh.ts`.
- Existing ground-track-mesh: `web/src/components/earth-view/ground-track-mesh.ts` —
  already renders a great-circle polyline for selected passes; the
  trailing-track mode would reuse it with different input data and a
  reduced opacity.
- Engine entry point: `core/orbital/passes.py` already does per-sample
  propagation; a `position_at(t)` helper is small and self-contained.
- API routes live in `api/routes/`; pattern to copy is `/sky-track`
  (similar shape: query a satellite over a time window, return samples).

---

## User-supplied custom TLEs

**Surfaced by:** product gap — Celestrak only covers what Celestrak
publishes, on Celestrak's refresh cadence. Recent launches, amateur
satellites, classified objects with publicly-shared TLEs (e.g. via
space-track.org), and any object the user has fresher data for can't
currently be queried.

**Problem.** Today the satellite catalog is fully Celestrak-driven. A
user with a valid TLE in hand has no way to plug it in — they have to
wait for Celestrak to publish (if it ever will) or fork the project.

**What needs to happen.**

- **Custom satellites panel.** New panel in the cinematic config
  surface for managing a saved list of user-supplied TLEs (add /
  rename / delete / pick). Trigger TBD — likely a "CUSTOM" chip
  alongside the existing config chips, or a subview within the
  SATELLITE chip's search panel. Each entry has: user-given name,
  raw TLE (line1 + line2, optional line0), parsed NORAD ID, derived
  epoch.
- **Persistence.** localStorage-backed so custom TLEs survive page
  reload. New zustand store (`web/src/store/custom-tles.ts`) with
  the same persistence pattern used by other stores.
- **Stateless API contract.** Frontend includes the TLE in the
  `/passes` and `/sky-track` request bodies as a `custom_tle: { line1,
  line2, name? }` field, mutually exclusive with the existing
  `satellite` field. Backend stays pure — no session storage, no
  expiry logic, no cleanup. Costs a few hundred bytes per request,
  worth it for the simplicity. Server-registered IDs explicitly
  rejected.
- **Server-side validation via skyfield.** When a TLE arrives in the
  request body, run it through `skyfield`'s parser (the same parser
  the engine uses for Celestrak TLEs) and return a structured 400
  error if invalid (bad checksum, malformed columns, unparseable
  epoch, etc.). Don't roll a custom validator — skyfield is the
  source of truth and gives real error messages. Frontend surfaces
  the error inline in the paste field.
- **Staleness warning.** TLEs encode their epoch in the data itself.
  Compute `now - epoch` and surface a warning chip on pass rows
  generated from custom TLEs when the TLE is more than ~14 days old
  (configurable; SGP4 accuracy degrades non-linearly past two weeks).
  Same warning shown on the saved-TLE list entry so the user knows
  to refresh before querying.
- **Selection wiring.** When a custom TLE is the active satellite,
  the SATELLITE chip displays the user-given name (e.g. "My Cubesat"
  rather than the NORAD ID). Pass rows, telemetry, and the globe
  satellite-marker label all use the user-given name.

**Useful context.**

- TLE parsing already exists at `core/catalog/` (Celestrak client +
  parser). The validation endpoint should reuse that parser, not
  reinvent it.
- Engine doesn't care about TLE source — `core/orbital/passes.py`
  takes a satellite object, not a NORAD ID. Plumbing custom TLEs
  through is a routes/schemas change, not an engine change.
- API schemas: `api/schemas/` — extend `PassRequest` and
  `SkyTrackRequest` with the optional `custom_tle` field; add a
  validator that enforces "exactly one of `satellite` or `custom_tle`."
- Cinematic config chips: `web/src/components/cinematic/config-chips/`.
  Existing satellite chip is `satellite-chip.tsx`; the search popover
  lives nearby.
- Persistence pattern: see `web/src/store/observer.ts` or similar for
  the zustand + localStorage idiom already in use.
- Out of scope (call out explicitly to avoid scope creep): bulk TLE
  import from a file, automatic refresh of stale TLEs from
  space-track.org, sharing custom TLEs between users/devices.

---

## Typed `TLENotFoundError` for live-mode 404 vs 502 distinction

**Surfaced by:** `feat/live-globe-position` (shipped 2026-04-28). Final review
flagged that `api/routes/now.py` catches both `LookupError` and the broad
`CelestrakError` and surfaces both as `HTTPException(404)`. Transient network
failures (Celestrak timeouts, 5xx responses) with no cached TLE will look
like "NORAD not found" to the frontend, causing the live-polling hook to
silently drop those satellites instead of retrying on the next poll.

**Problem.** `core/catalog/celestrak.py:100` raises `CelestrakError("Celestrak
returned no results for NORAD …")` for genuine not-found cases, but the same
exception class is used for network errors, malformed responses, and other
upstream failures. Once the TLE fetcher's stale-cache fallback kicks in, only
the cold-cache + transient-failure case actually surfaces — but that's the
case live-polling cares about most (a brand-new search target where the cache
is empty).

**What needs to happen.**

- Introduce `core/catalog/celestrak.py: class CelestrakNotFoundError(CelestrakError)`.
- Raise it specifically at line 100 when `_parse_3le_text(body)` returns no TLEs.
- In `api/routes/now.py`, catch `(LookupError, CelestrakNotFoundError)` for 404
  and let other `CelestrakError` variants propagate (the existing
  `_celestrak_error_handler` in `api/app.py` will surface them as 500).
- Add an integration test for the network-error case using `httpx.MockTransport`
  returning a 502.

**Useful context.**

- Existing exception hierarchy: `core/catalog/celestrak.py:24` defines `CelestrakError`.
- The fetcher's stale-cache fallback at `core/catalog/fetcher.py:104-107` swallows
  most transient failures, so this only matters for cold-cache + upstream-fail.
- Out of scope: changing the existing `/passes` route's exception handling.

---

## Multi-NORAD integration test for `/now-positions` and `/now-tracks`

**Surfaced by:** `feat/live-globe-position` (shipped 2026-04-28). The integration
tests in `tests/integration/test_now_routes.py` only cover single-NORAD requests,
but the spec's primary use case is group queries (e.g., "stations" → ISS +
Tiangong). The route's per-NORAD loop is exercised in production but not
verified by tests.

**Problem.** A regression in the `for nid in req.norad_ids:` loop (e.g., wrong
ordering, missing entry, wrong NORAD echoed back) would slip through CI today.

**What needs to happen.**

- Add `test_now_positions_multi_norad`: post with `norad_ids=[25544, 48274]`,
  fixture serves both via `_fake_transport_from`'s URL-aware path (already
  in place from the original task), assert two entries in response order matches
  request order, both have plausible sample data.
- Add `test_now_tracks_multi_norad`: same shape but for the trail endpoint.
- Add a `tests/fixtures/celestrak/tiangong_single.txt` fixture if not already
  present (current branch only uses `iss_single.txt`).

**Useful context.**

- The existing `_fake_transport_from` at `tests/integration/test_now_routes.py:23-36`
  inspects `CATNR` query params; extend the lookup table.
- Reuse the `client` fixture pattern from the same file.

---

## Per-frame allocation polish in `EarthView` live render loop

**Surfaced by:** `feat/live-globe-position` (shipped 2026-04-28). The rAF loop
in `web/src/components/earth-view/earth-view.tsx:142-149` projects each trail
sample to `{lat, lng, alt_km}` every frame, allocating ~200 small objects per
second at typical N (1-4 sats × ~20 trail samples × 60 fps).

**Problem.** Pure waste: `liveTrails.setTrails` only reads those three fields
from the input anyway. The intermediate projection is gratuitous, and `Map`
allocation per-frame contributes minor GC pressure that's avoidable.

**What needs to happen.**

- Update `web/src/components/earth-view/live-trails-mesh.ts` to accept
  `TrackSampleResponse[]` (or a structurally compatible type with `lat/lng/alt_km`)
  directly in `setTrails`, removing the need for the projection.
- Drop the `.map((s) => ({lat, lng, alt_km}))` from `earth-view.tsx`'s rAF loop.
- The live-trails-mesh tests should still pass since the input shape is widened,
  not narrowed.

**Useful context.**

- `live-trails-mesh.ts:30-34` reads only `lat`, `lng`, `alt_km` from each sample.
- Existing test in `live-trails-mesh.test.ts` uses minimal `{lat, lng, alt_km}`
  objects — would still work with the widened type.

---

## TLE freshness indicator for live-mode markers

**Surfaced by:** `feat/live-globe-position` (shipped 2026-04-28). Pass-row UI
already surfaces TLE age via `tle_epoch` / `fetched_age_seconds`. Live mode has
no equivalent — a stale TLE (e.g., 30+ days old) would silently produce
positions that drift from reality without any user-facing signal.

**Problem.** SGP4 accuracy degrades non-linearly past ~14 days. A live marker
on the globe with an old TLE looks just as authoritative as one with a fresh
TLE, but its position could be off by tens of kilometers.

**What needs to happen.**

- Extend the `/now-positions` response with `tle_epoch: datetime` and
  `fetched_age_seconds: float` per entry (mirror the existing pattern from
  `/tle-freshness`).
- Frontend: add a small staleness chip near the live marker count (or the
  PanelTelemetry header) when the oldest active TLE is > 14 days.
- Decide whether to *block* live mode for very stale TLEs (> 30 days?) or just
  warn — likely just warn, with copy explaining the SGP4 accuracy degradation.

**Useful context.**

- `core/catalog/fetcher.py: TLEFetcher.get_tle()` returns `(tle, age_seconds)`.
- Existing freshness UI: `web/src/components/passes/pass-card.tsx` for the
  pass-mode reference.
