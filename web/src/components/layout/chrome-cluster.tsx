import { useEffect } from "react";
import { ModeToggle } from "./mode-toggle";
import { DisplayTzToggle } from "./display-tz-toggle";
import { useAppModeStore } from "@/store/app-mode";
import { useDisplayTzStore } from "@/store/display-tz";

const DISPLAY_TZ_ORDER = ["client", "observer", "utc"] as const;

/** Top-right floating cluster — Mode + TZ toggles. Used in both cinematic
 *  and research layouts. Mounts the Cmd-M and Cmd-T keyboard shortcuts.
 *  Cmd-V (visibility) now lives on `VisibilityChip` in the cinematic config
 *  row and is not mounted here. */
export function ChromeCluster() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "m") {
        e.preventDefault();
        const cur = useAppModeStore.getState().mode;
        useAppModeStore.getState().setMode(
          cur === "cinematic" ? "research" : "cinematic",
        );
      } else if (key === "t") {
        e.preventDefault();
        const cur = useDisplayTzStore.getState().mode;
        const idx = DISPLAY_TZ_ORDER.indexOf(cur);
        const next = DISPLAY_TZ_ORDER[(idx + 1) % DISPLAY_TZ_ORDER.length];
        useDisplayTzStore.getState().setMode(next);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <ModeToggle />
      <DisplayTzToggle />
    </div>
  );
}
