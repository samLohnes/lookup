import { useMemo } from "react";
import { useCurrentPasses } from "@/hooks/use-current-passes";
import { useObserverStore } from "@/store/observer";
import { useDisplayTzStore } from "@/store/display-tz";
import { useObserverTimezone } from "@/hooks/use-observer-timezone";
import { formatTimeInTz } from "@/lib/format-time";
import { tonightWindow } from "@/lib/sun";
import type { PassItem } from "@/types/api";

export interface TonightSummary {
  count: number;
  brightest: PassItem | null;
  highest: PassItem | null;
  passes: PassItem[];
  /** Window labels in local-time strings for display. */
  windowLabel: string;
}

/** Return a summary of satellite passes within tonight's sunset→sunrise window.
 *  Returns null when data is unavailable or no passes fall in the window. */
export function useTonightSummary(now: Date = new Date()): TonightSummary | null {
  const observer = useObserverStore((s) => s.current);
  const { data } = useCurrentPasses();
  const mode = useDisplayTzStore((s) => s.mode);
  const { data: observerTz } = useObserverTimezone();

  return useMemo(() => {
    if (!data) return null;
    const { sunset, nextSunrise } = tonightWindow(now, observer.lat, observer.lng);

    const passes = data.passes.filter((p) => {
      const rise = Date.parse(p.rise.time);
      const set = Date.parse(p.set.time);
      // Pass overlaps the tonight window if it ends after sunset AND starts before sunrise.
      return set >= sunset.getTime() && rise <= nextSunrise.getTime();
    });

    if (passes.length === 0) return null;

    const brightest = passes.reduce<PassItem | null>((best, p) => {
      if (p.max_magnitude == null) return best;
      if (best == null || best.max_magnitude == null) return p;
      return p.max_magnitude < best.max_magnitude ? p : best;
    }, null);

    const highest = passes.reduce<PassItem>(
      (best, p) =>
        p.peak.elevation_deg > best.peak.elevation_deg ? p : best,
      passes[0],
    );

    const fmt = (d: Date) =>
      formatTimeInTz(d.toISOString(), mode, observerTz?.timezone ?? null, {
        hour: "numeric",
        minute: "2-digit",
      });
    const windowLabel = `${fmt(sunset)} – ${fmt(nextSunrise)}`;

    return { count: passes.length, brightest, highest, passes, windowLabel };
  }, [data, observer.lat, observer.lng, now, mode, observerTz]);
}
