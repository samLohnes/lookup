import { useDraftInputsStore } from "@/store/draft-inputs";
import { useCurrentPasses } from "@/hooks/use-current-passes";
import { cssTransition } from "@/lib/motion";

/** Run chip — commits all drafts and reflects the passes-query status.
 *  Three states:
 *    idle:    no drafts, not fetching -> muted, disabled
 *    dirty:   drafts diverge, not fetching -> amber + border pulse
 *    loading: query in flight -> spinner glyph, disabled
 *  Clicking in dirty state calls `commit()` on the draft store, which
 *  writes through to the committed observer/satellite/time-range stores
 *  and triggers TanStack Query to refetch on the next render.
 */
export function RunChip() {
  const isDirty = useDraftInputsStore((s) => s.isDirty());
  const changeCount = useDraftInputsStore((s) => s.changeCount());
  const commit = useDraftInputsStore((s) => s.commit);
  const { isFetching } = useCurrentPasses();

  const state: "idle" | "dirty" | "loading" = isFetching
    ? "loading"
    : isDirty
      ? "dirty"
      : "idle";

  const label =
    state === "loading" ? "RUNNING" : state === "dirty" ? "PENDING" : "READY";
  const valueText =
    state === "loading" ? "…" : "Run";
  const ariaLabel =
    state === "loading"
      ? "Running…"
      : state === "dirty"
        ? `Run — ${changeCount} pending ${changeCount === 1 ? "change" : "changes"}`
        : "Run (no changes)";

  const disabled = state !== "dirty";

  const classes =
    "relative rounded-md px-3 py-1.5 text-left backdrop-blur border " +
    (state === "dirty"
      ? "bg-accent-400/18 border-accent-400/55 text-accent-100 animate-run-border-pulse cursor-pointer "
      : state === "loading"
        ? "bg-accent-400/10 border-accent-400/30 text-[#ffdcaa] cursor-wait "
        : "bg-bg-raised/60 border-accent-400/15 text-[#8a7c68] cursor-not-allowed ");

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      disabled={disabled}
      onClick={state === "dirty" ? commit : undefined}
      className={
        classes +
        "hover:brightness-110 " +
        "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgba(255,174,96,0.8)]"
      }
      style={{
        transition: cssTransition("background, color", "fast"),
      }}
    >
      <div className="text-[9px] uppercase tracking-[0.1em] leading-none mb-1 opacity-70">
        {label}
      </div>
      <div className="text-[12px] leading-none font-medium">{valueText}</div>
    </button>
  );
}
