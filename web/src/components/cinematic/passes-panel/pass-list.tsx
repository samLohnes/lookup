import { useState } from "react";
import { useCurrentPasses } from "@/hooks/use-current-passes";
import { useSelectionStore } from "@/store/selection";
import type { PassItem } from "@/types/api";
import { PassRow } from "./pass-row";

/** Scrollable list of passes with single-row expansion. Clicking a row
 *  expands it AND selects the pass globally (drives sky view + telemetry
 *  below). Re-clicking an expanded row collapses it but keeps the
 *  selection — per design: "expansion is for viewing details; selection
 *  drives the sky view below." */
export function PassList() {
  const { data } = useCurrentPasses();
  const passes: PassItem[] = data?.passes ?? [];
  const selectedPassId = useSelectionStore((s) => s.selectedPassId);
  const select = useSelectionStore((s) => s.select);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const onToggle = (passId: string) => {
    if (expandedId === passId) {
      // Row is already expanded — collapse it. Keep selection.
      setExpandedId(null);
    } else {
      // Expand this row, collapse any other, AND select the pass.
      setExpandedId(passId);
      select(passId);
    }
  };

  if (passes.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex items-center justify-center px-4 text-center text-[12px] text-[#8a7c68]">
        No passes tonight
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-2">
      {passes.map((pass) => (
        <PassRow
          key={pass.id}
          pass={pass}
          isExpanded={expandedId === pass.id}
          isSelected={selectedPassId === pass.id}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
