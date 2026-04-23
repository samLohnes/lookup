import { useState } from "react";
import { useTimeRangeStore } from "@/store/time-range";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/** Top-right chrome pill that toggles between line-of-sight and naked-eye
 *  visibility modes. Reads/writes `mode` on the time-range store. */
export function VisibilityModeToggle() {
  const mode = useTimeRangeStore((s) => s.mode);
  const setMode = useTimeRangeStore((s) => s.setMode);
  const [open, setOpen] = useState(false);
  const label = mode === "line-of-sight" ? "👁 Line-of-sight" : "🌙 Naked-eye";

  const choose = (m: "line-of-sight" | "naked-eye") => {
    setMode(m);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="px-3 py-1.5 text-xs rounded-md bg-bg-raised/85 border border-edge/40 text-fg-muted backdrop-blur-sm hover:bg-bg-raised"
        >
          {label} ▾
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1">
        <button
          type="button"
          onClick={() => choose("line-of-sight")}
          className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-bg text-fg"
        >
          👁 Line-of-sight
        </button>
        <button
          type="button"
          onClick={() => choose("naked-eye")}
          className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-bg text-fg"
        >
          🌙 Naked-eye
        </button>
      </PopoverContent>
    </Popover>
  );
}
