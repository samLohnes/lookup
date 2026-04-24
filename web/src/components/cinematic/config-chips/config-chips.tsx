import { useEffect, useState } from "react";
import { ObserverPanel } from "@/components/observer/observer-panel";
import { SatelliteSearchBody } from "@/components/satellite/satellite-search-body";
import { TimeRangePicker } from "@/components/time/time-range-picker";
import { useDraftInputsStore } from "@/store/draft-inputs";
import { useObserverStore } from "@/store/observer";
import { useSatelliteStore } from "@/store/satellite";
import { useTimeRangeStore } from "@/store/time-range";
import { useDisplayTzStore } from "@/store/display-tz";
import { useObserverTimezone } from "@/hooks/use-observer-timezone";
import { formatWindowChip } from "@/lib/format-time";
import { ConfigChip } from "./config-chip";
import { VisibilityChip } from "./visibility-chip";
import { RunChip } from "./run-chip";
import { useConfigChipDirtiness } from "./use-config-chip-dirtiness";

/** Truncate `s` to at most `max` chars, appending an ellipsis when shortened. */
function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

/** Top-left chip row mounted in cinematic mode. Composes five chips:
 *  Observer, Satellite, Window, Visibility, Run. Owns the Cmd-K shortcut
 *  which opens the Satellite popover (replaces the old LeftDrawer shortcut). */
export function ConfigChips() {
  const dirty = useConfigChipDirtiness();

  // Committed values drive what each chip displays.
  const observerName = useObserverStore((s) => s.current.name);
  const satelliteQuery = useSatelliteStore((s) => s.query);
  const { fromUtc, toUtc } = useTimeRangeStore();
  const tzMode = useDisplayTzStore((s) => s.mode);
  const { data: observerTzData } = useObserverTimezone();
  const observerTz = observerTzData?.timezone ?? null;

  // Controlled open state for the Satellite popover so Cmd-K can open it.
  const [satOpen, setSatOpen] = useState(false);

  // Discard callback reverts ALL drafts (per-chip revert is not in the store).
  // Acceptable for MVP; follow-up can add isolated revert helpers.
  const revertAll = useDraftInputsStore((s) => s.revert);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      setSatOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <ConfigChip
        label="OBSERVER"
        value={truncate(observerName || "—", 18)}
        isDirty={dirty.observer}
        popoverTitle="Edit observer"
        onDiscard={revertAll}
        popoverWidth={360}
      >
        <ObserverPanel />
      </ConfigChip>

      <ConfigChip
        label="SATELLITE"
        value={truncate(satelliteQuery || "—", 20)}
        isDirty={dirty.satellite}
        popoverTitle="Edit satellite"
        onDiscard={revertAll}
        popoverWidth={440}
        popoverHeight={520}
        open={satOpen}
        onOpenChange={setSatOpen}
      >
        <SatelliteSearchBody onSelect={() => setSatOpen(false)} />
      </ConfigChip>

      <ConfigChip
        label="WINDOW"
        value={formatWindowChip(fromUtc, toUtc, tzMode, observerTz)}
        isDirty={dirty.window}
        popoverTitle="Edit window"
        onDiscard={revertAll}
      >
        <TimeRangePicker />
      </ConfigChip>

      <VisibilityChip />

      <RunChip />
    </div>
  );
}
