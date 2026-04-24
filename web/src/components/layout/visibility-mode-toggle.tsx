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
          className={
            "px-3 py-1.5 text-xs font-medium rounded-md " +
            "bg-bg-raised/78 border border-accent-400/18 text-fg-muted " +
            "backdrop-blur-sm " +
            "hover:border-accent-400/35 hover:text-fg " +
            "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgba(255,174,96,0.8)] " +
            (open
              ? "!bg-accent-400/14 !border-accent-400/50 !text-accent-200 "
              : "")
          }
          style={{
            transition:
              "background 180ms cubic-bezier(0.22, 1, 0.36, 1), " +
              "border-color 180ms cubic-bezier(0.22, 1, 0.36, 1), " +
              "color 180ms cubic-bezier(0.22, 1, 0.36, 1), " +
              "box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
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
