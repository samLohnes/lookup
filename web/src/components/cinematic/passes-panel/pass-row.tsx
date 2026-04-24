import type { PassItem } from "@/types/api";
import { azimuthToCompass } from "@/lib/compass";
import { formatTimeInTz } from "@/lib/format-time";
import { useDisplayTzStore } from "@/store/display-tz";
import { useObserverTimezone } from "@/hooks/use-observer-timezone";
import { cssTransition } from "@/lib/motion";
import { PassRowExpanded } from "./pass-row-expanded";

const PEAK_TIME_OPTS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
};

interface PassRowProps {
  pass: PassItem;
  isExpanded: boolean;
  isSelected: boolean;
  /** Fires with the pass id on click. Parent decides whether to expand/collapse/select. */
  onToggle: (passId: string) => void;
}

/** A single row in the scrollable pass list. Collapsed shows peak time +
 *  rise-direction summary. Expanded shows a four-section accordion via
 *  `PassRowExpanded`. The row is a single <button> so keyboard users can
 *  Tab to it and Enter/Space toggles. */
export function PassRow({ pass, isExpanded, isSelected, onToggle }: PassRowProps) {
  const tzMode = useDisplayTzStore((s) => s.mode);
  const { data: tzData } = useObserverTimezone();
  const observerTz = tzData?.timezone ?? null;

  const peakTime = formatTimeInTz(pass.peak.time, tzMode, observerTz, PEAK_TIME_OPTS);
  const riseCompass = azimuthToCompass(pass.rise.azimuth_deg);
  const peakElevation = pass.peak.elevation_deg.toFixed(0);

  const className =
    "w-full text-left rounded-md p-2.5 mb-1 " +
    "border " +
    (isSelected
      ? "bg-accent-400/10 border-accent-400/45 "
      : "bg-white/[0.02] border-accent-400/8 hover:bg-white/[0.04] hover:border-accent-400/18 ");

  return (
    <button
      type="button"
      aria-expanded={isExpanded}
      onClick={() => onToggle(pass.id)}
      className={className}
      style={{ transition: cssTransition("background, border-color", "fast") }}
    >
      <div className="font-serif text-[16px] font-medium text-[#e8d8c0] leading-tight">
        {peakTime}
      </div>
      <div className="text-[11px] text-[#a89a84] mt-0.5">
        rises {riseCompass} · peaks {peakElevation}°
      </div>
      {isExpanded && <PassRowExpanded pass={pass} />}
    </button>
  );
}
