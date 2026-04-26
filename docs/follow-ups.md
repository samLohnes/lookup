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
