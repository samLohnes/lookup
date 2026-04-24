import { useState } from "react";
import { useAppModeStore, type AppMode } from "@/store/app-mode";
import { useWindowWidth } from "@/hooks/use-window-width";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const LABELS: Record<AppMode, string> = {
  cinematic: "🎬 Cinematic",
  research: "📊 Research",
};

/** Top-right chrome pill that toggles between cinematic and research layouts. */
export function ModeToggle() {
  const mode = useAppModeStore((s) => s.mode);
  const setMode = useAppModeStore((s) => s.setMode);
  const [open, setOpen] = useState(false);
  const narrow = useWindowWidth() < 900;

  const choose = (m: AppMode) => {
    setMode(m);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={narrow}
          title={narrow ? "Cinematic mode is desktop-only" : undefined}
          className={
            "px-3 py-1.5 text-xs font-medium rounded-md " +
            "bg-bg-raised/78 border border-accent-400/18 text-fg-muted " +
            "backdrop-blur-sm " +
            "hover:border-accent-400/35 hover:text-fg " +
            "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_rgba(255,174,96,0.8)] " +
            (narrow ? "opacity-50 cursor-not-allowed " : "") +
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
          {LABELS[mode]} ▾
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-40 p-1">
        <button
          type="button"
          onClick={() => choose("cinematic")}
          className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-bg text-fg"
        >
          {LABELS.cinematic}
        </button>
        <button
          type="button"
          onClick={() => choose("research")}
          className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-bg text-fg"
        >
          {LABELS.research}
        </button>
      </PopoverContent>
    </Popover>
  );
}
