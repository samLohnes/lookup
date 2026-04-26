import type { PassItem } from "@/types/api";
import { azimuthToCompass } from "@/lib/compass";
import { formatDurationShort, formatTimeInTz } from "@/lib/format-time";
import { formatPassAsIcs, downloadIcs } from "@/lib/ics";
import { useObserverStore } from "@/store/observer";
import { useDisplayTzStore } from "@/store/display-tz";
import { useObserverTimezone } from "@/hooks/use-observer-timezone";
import { cssTransition } from "@/lib/motion";

const TIMING_OPTS: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
};

/** Derive the sunlit text from sunlit_fraction. */
function formatSunlit(fraction: number): string {
  if (fraction >= 0.9) return "yes";
  if (fraction <= 0.1) return "no";
  return `partial (${Math.round(fraction * 100)}%)`;
}

interface PassRowExpandedProps {
  pass: PassItem;
}

/** Accordion body for a single pass row. Four sections + ICS export. */
export function PassRowExpanded({ pass }: PassRowExpandedProps) {
  const observerName = useObserverStore((s) => s.current.name);
  const tzMode = useDisplayTzStore((s) => s.mode);
  const { data: tzData } = useObserverTimezone();
  const observerTz = tzData?.timezone ?? null;

  const riseTime = formatTimeInTz(pass.rise.time, tzMode, observerTz, TIMING_OPTS);
  const peakTime = formatTimeInTz(pass.peak.time, tzMode, observerTz, TIMING_OPTS);
  const setTime = formatTimeInTz(pass.set.time, tzMode, observerTz, TIMING_OPTS);

  const magText = pass.max_magnitude === null
    ? "—"
    : pass.max_magnitude.toFixed(1).replace(/^-/, "−"); // typographic minus

  const sunlitText = pass.kind === "single"
    ? formatSunlit(pass.sunlit_fraction)
    : "—";

  const satelliteText = pass.name;

  const handleIcsExport = () => {
    const ics = formatPassAsIcs(pass, { observerName });
    const filename = `pass-${pass.id}.ics`;
    downloadIcs(filename, ics);
  };

  return (
    <div className="mt-2.5 pt-2.5 border-t border-accent-400/15 text-[11px] font-sans">
      <Section label="Timing">
        <KV k="Rise" v={riseTime} />
        <KV k="Peak" v={peakTime} />
        <KV k="Set" v={setTime} />
        <KV k="Duration" v={formatDurationShort(pass.duration_s)} />
      </Section>

      <Section label="Geometry">
        <KV
          k="Rise"
          v={`${azimuthToCompass(pass.rise.azimuth_deg)} · ${pass.rise.elevation_deg.toFixed(0)}°`}
        />
        <KV
          k="Peak"
          v={`${azimuthToCompass(pass.peak.azimuth_deg)} · ${pass.peak.elevation_deg.toFixed(0)}°`}
        />
        <KV
          k="Set"
          v={`${azimuthToCompass(pass.set.azimuth_deg)} · ${pass.set.elevation_deg.toFixed(0)}°`}
        />
      </Section>

      <Section label="Visibility">
        <KV k="Peak mag" v={magText} />
        <KV
          k="Visible"
          v={
            pass.kind !== "single" || pass.naked_eye_visible === null
              ? "—"
              : pass.naked_eye_visible
          }
        />
        <KV k="Sunlit" v={sunlitText} />
      </Section>

      <Section label="Orbital">
        <KV k="Range peak" v={`${pass.peak.range_km.toFixed(0)} km`} />
        <KV
          k="Ang. speed"
          v={
            pass.kind === "single"
              ? `${pass.peak_angular_speed_deg_s.toFixed(2)}°/s`
              : "—"
          }
        />
        <KV k="Satellite" v={satelliteText} />
      </Section>

      <div className="pt-2.5 pb-1">
        <button
          type="button"
          onClick={handleIcsExport}
          className={
            "bg-accent-400/12 border border-accent-400/45 text-accent-200 " +
            "px-3 py-1.5 rounded text-[11px] hover:bg-accent-400/22 hover:text-accent-50"
          }
          style={{ transition: cssTransition("background, color", "fast") }}
        >
          📅 ICS export
        </button>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5">
      <div className="text-[9px] uppercase tracking-[0.1em] text-[#8a7c68] mb-1">{label}</div>
      <div className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-0.5 tabular-nums">
        {children}
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <>
      <span className="text-[#8a7c68]">{k}</span>
      <span className="text-[#e8d8c0]">{v}</span>
    </>
  );
}
