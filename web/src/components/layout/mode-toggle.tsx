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
            "px-3 py-1.5 text-xs rounded-md bg-bg-raised/85 border border-edge/40 text-fg-muted backdrop-blur-sm hover:bg-bg-raised " +
            (narrow ? "opacity-50 cursor-not-allowed" : "")
          }
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
