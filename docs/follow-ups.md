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

## Live satellite position on 3D globe when no pass is selected

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
