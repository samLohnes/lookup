import { useCurrentPasses } from "@/hooks/use-current-passes";
import { usePlaybackStore } from "@/store/playback";
import { useSelectionStore } from "@/store/selection";

/** A native range input bound to the cursor. The user can drag to seek. */
export function ScrubBar() {
  const { data } = useCurrentPasses();
  const cursor = usePlaybackStore((s) => s.cursorUtc);
  const seekTo = usePlaybackStore((s) => s.seekTo);
  const selectedId = useSelectionStore((s) => s.selectedPassId);

  if (!data || !selectedId) {
    return (
      <div className="text-xs text-fg-subtle py-2">
        Select a pass to scrub.
      </div>
    );
  }

  const pass = data.passes.find((p) => p.id === selectedId);
  if (!pass) return null;
  const startMs = Date.parse(pass.rise.time);
  const endMs = Date.parse(pass.set.time);
  const cursorMs = cursor ? Date.parse(cursor) : startMs;
  const value = Math.max(0, Math.min(cursorMs - startMs, endMs - startMs));

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="label-upper">cursor</span>
      <input
        aria-label="Scrub"
        type="range"
        min={0}
        max={endMs - startMs}
        step={1000}
        value={value}
        onChange={(e) => {
          const ms = Number(e.target.value);
          seekTo(new Date(startMs + ms).toISOString());
        }}
        className="flex-1 accent-satellite"
      />
      <span className="text-xs tabular-nums text-fg-muted">
        {formatSecondsWithinPass(value)}
      </span>
    </div>
  );
}

function formatSecondsWithinPass(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `+${m}:${s.toString().padStart(2, "0")}`;
}
