import { useSelectionStore } from "@/store/selection";
import type { PassItem } from "@/types/api";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import { PassExportButton } from "@/components/passes/pass-export-button";

interface Props {
  pass: PassItem;
}

/** A clickable card displaying key info about a single satellite pass. */
export function PassCard({ pass }: Props) {
  const selectedId = useSelectionStore((s) => s.selectedPassId);
  const select = useSelectionStore((s) => s.select);
  const isSelected = selectedId === pass.id;

  const riseLocal = new Date(pass.rise.time).toLocaleString();
  const mag =
    pass.max_magnitude != null ? `mag ${pass.max_magnitude.toFixed(1)}` : null;

  return (
    <div
      onClick={() => select(pass.id)}
      role="button"
      tabIndex={0}
      aria-label={pass.name}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          select(pass.id);
        }
      }}
      className={cn(
        "block w-full text-left p-3 rounded-card border transition-colors cursor-pointer",
        isSelected
          ? "border-satellite bg-satellite/5"
          : "border-edge hover:bg-edge",
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-medium truncate">{pass.name}</div>
        <div className="text-xs text-fg-muted tabular-nums">
          {formatDuration(pass.duration_s)}
        </div>
      </div>
      <div className="text-xs text-fg-muted mt-1">{riseLocal}</div>
      <div className="text-xs text-fg-muted mt-0.5 tabular-nums">
        peak {pass.peak.elevation_deg.toFixed(0)}° ·{" "}
        {pass.peak.azimuth_deg.toFixed(0)}°
        {mag && ` · ${mag}`}
      </div>
      {pass.kind === "train" && (
        <div className="text-xs text-satellite mt-1">
          {pass.member_count} objects
        </div>
      )}
      <div className="mt-2 flex justify-end">
        <PassExportButton pass={pass} />
      </div>
    </div>
  );
}
