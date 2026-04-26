# Follow-ups

Known limitations and engineering tickets that came out of completed work.
One-off bugs go through normal git/PR flow; these are larger gaps that need
a design pass before implementation.

---

## Refresh catalog so "starlink" surfaces real trains

**Surfaced by:** [`feat/engine-accuracy-and-pass-row`](docs/superpowers/specs/2026-04-24-engine-accuracy-and-pass-row-design.md) (merged 2026-04-26).

**Problem.** [`core/catalog/search.py:47`](../core/catalog/search.py:47) hardcodes
the "starlink" group to 5 NORAD IDs from a 2019 launch:

```python
("starlink", (44713, 44714, 44715, 44716, 44717)),
```

When a user picks "starlink" from the search dropdown:

1. The query resolves to those 5 NORADs.
2. [`api/routes/passes.py`](../api/routes/passes.py) fetches the full
   Starlink TLE group from Celestrak (~10,240 sats) and filters down to
   those 5.
3. Those 5 sats spread out years ago — they don't form a co-orbital cluster
   anymore.
4. [`core/trains/clustering.group_into_trains`](../core/trains/clustering.py)
   runs on the 5 and finds nothing to cluster.
5. Picking "starlink" from the dropdown effectively **never** produces a
   `TrainPass` in production.

The file's own comment acknowledges this is M1 placeholder work:

> "Small, hand-curated catalog for M1. Covers the most common queries
> (ISS, Hubble) and a couple of groups (starlink, stations). M2 replaces
> this with a live Celestrak-backed index."

**What needs to happen.**

- Replace the hardcoded `("starlink", (44713, ..., 44717))` group with
  logic that pulls the live Celestrak Starlink group (or a recent subset
  — e.g. satellites whose international designator's launch year/number
  is within the last ~30 days).
- "Stations" can probably stay hardcoded (ISS + Tiangong don't change).
- Decide whether to surface multiple Starlink "trains" by recent-launch
  grouping (each launch becomes its own selectable item like
  "Starlink G10-24") instead of one monolithic "starlink" entry.
- Consider whether the catalog should be location-aware (only surface
  trains visible from the current observer) — though the per-pass
  elevation filter already drops invisible passes after prediction, so
  this is a UX question, not a correctness one.

**Useful context.**

- We just verified (in the merged feature branch, see
  [`docs/accuracy-log.md`](accuracy-log.md) entry dated 2026-04-26) that
  train clustering itself works correctly when fed real co-orbital sats —
  the bug is purely in catalog selection.
- Celestrak group endpoint:
  `https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle`
  (already used via [`core/catalog/celestrak.py`](../core/catalog/celestrak.py)).
- International designator parsing (year + launch number) lives in TLE
  line 1 cols 10-17.

**Suggested approach.** Design proposal first (live-fetch vs cached
snapshot, single "starlink" entry vs per-launch entries, refresh
cadence). Don't implement until reviewed.

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
