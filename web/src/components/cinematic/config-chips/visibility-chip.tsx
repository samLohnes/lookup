import { useEffect } from "react";
import { useTimeRangeStore } from "@/store/time-range";
import { cssTransition } from "@/lib/motion";

/** Click-to-flip chip for line-of-sight <-> naked-eye visibility mode.
 *  Visually identical to `ConfigChip` but has no popover — clicking the
 *  chip flips the store mode immediately. Also owns the Cmd-V / Ctrl-V
 *  keyboard shortcut (ignored while focus is in an input). */
export function VisibilityChip() {
  const mode = useTimeRangeStore((s) => s.mode);
  const setMode = useTimeRangeStore((s) => s.setMode);

  const value = mode === "line-of-sight" ? "Line-of-sight" : "Naked-eye";
  const nextValue = mode === "line-of-sight" ? "naked-eye" : "line-of-sight";

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) {
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== "v") return;
      e.preventDefault();
      const cur = useTimeRangeStore.getState().mode;
      useTimeRangeStore
        .getState()
        .setMode(cur === "line-of-sight" ? "naked-eye" : "line-of-sight");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const ariaLabel = `Visibility: ${value} (click to switch to ${nextValue})`;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={() => setMode(nextValue as "line-of-sight" | "naked-eye")}
      className={
        "relative rounded-md px-3 py-1.5 text-left backdrop-blur " +
        "border bg-bg-raised/72 border-accent-400/20 " +
        "hover:bg-bg-raised/85 hover:border-accent-400/35 " +
        "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgba(255,174,96,0.8)]"
      }
      style={{
        transition: cssTransition("background, border-color, color", "fast"),
      }}
    >
      <div className="text-[9px] uppercase tracking-[0.1em] text-[#8a7c68] leading-none mb-1">
        VISIBILITY
      </div>
      <div className="text-[12px] leading-none text-[#e8d8c0]">{value}</div>
    </button>
  );
}
