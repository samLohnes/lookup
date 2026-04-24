import { useEffect } from "react";
import { ModeToggle } from "./mode-toggle";
import { VisibilityModeToggle } from "./visibility-mode-toggle";
import { DisplayTzToggle } from "./display-tz-toggle";
import { useAppModeStore } from "@/store/app-mode";
import { useTimeRangeStore } from "@/store/time-range";
import { useDisplayTzStore } from "@/store/display-tz";

const DISPLAY_TZ_ORDER = ["client", "observer", "utc"] as const;

/** Top-right floating cluster of chrome pills used in both cinematic and
 *  research layouts. Also mounts global keyboard shortcuts:
 *    Cmd-M / Ctrl-M — toggle cinematic <-> research
 *    Cmd-V / Ctrl-V — toggle line-of-sight <-> naked-eye
 *    Cmd-T / Ctrl-T — cycle display tz (client -> observer -> UTC -> client)
 *
 *  Shortcuts are ignored when the event target is an input/textarea so
 *  users typing in the address search don't accidentally toggle modes. */
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
      } else if (key === "v") {
        e.preventDefault();
        const cur = useTimeRangeStore.getState().mode;
        useTimeRangeStore.getState().setMode(
          cur === "line-of-sight" ? "naked-eye" : "line-of-sight",
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
      <VisibilityModeToggle />
      <DisplayTzToggle />
    </div>
  );
}
