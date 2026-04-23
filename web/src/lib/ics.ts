import type { PassItem, PassResponse, TrainPassResponse } from "@/types/api";

interface FormatOpts {
  observerName: string;
}

/** Convert an ISO-8601 UTC string to ICS DATE-TIME UTC format.
 *
 *  Input must end in 'Z' (UTC marker). Non-UTC offsets and missing-Z inputs
 *  will produce malformed ICS output. Our API always returns Z-suffixed UTC
 *  ISO strings, and `new Date().toISOString()` always emits Z; this function
 *  is only safe for those paths.
 *
 *  Example: "2026-05-01T02:00:00Z" → "20260501T020000Z"
 */
function toIcsUtc(iso: string): string {
  // 2026-05-01T02:00:00Z → 20260501T020000Z
  return iso.replace(/[-:]/g, "").replace(/\.\d+Z?$/, "Z").replace("Z", "Z");
}

/** Escape text for use in ICS property values. */
function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** Build a multiline DESCRIPTION string for a pass.
 *  Lines are joined with the ICS literal `\n` sequence (not escaped further). */
function describePass(pass: PassItem): string {
  const peakEl = pass.peak.elevation_deg.toFixed(0);
  const peakAz = pass.peak.azimuth_deg.toFixed(0);
  const lines = [
    `Duration: ${Math.floor(pass.duration_s / 60)}m ${(pass.duration_s % 60)
      .toString()
      .padStart(2, "0")}s`,
    `Rise: az ${pass.rise.azimuth_deg.toFixed(0)}°`,
    `peak ${peakEl}° at azimuth ${peakAz}°`,
    `Set: az ${pass.set.azimuth_deg.toFixed(0)}°`,
  ];
  if (pass.max_magnitude != null) {
    lines.push(`magnitude ${pass.max_magnitude.toFixed(1)}`);
  }
  // Each segment is escaped individually; join with the ICS literal newline.
  return lines.map(escapeText).join("\\n");
}

/** Return the human-readable SUMMARY for the calendar event. */
function passName(pass: PassItem): string {
  if (pass.kind === "train") {
    return `${pass.name}`;
  }
  const single = pass as PassResponse;
  return `${single.name} pass`;
}

/** Return the stable ID for the pass. */
function passId(pass: PassItem): string {
  if (pass.kind === "train") {
    const t = pass as TrainPassResponse;
    return t.id;
  }
  const s = pass as PassResponse;
  return s.id;
}

/** Format a pass as an ICS string suitable for writing to a .ics file. */
export function formatPassAsIcs(pass: PassItem, opts: FormatOpts): string {
  const dtstart = toIcsUtc(pass.rise.time);
  const dtend = toIcsUtc(pass.set.time);
  const uid = `${passId(pass)}@satellite-visibility`;
  const dtstamp = toIcsUtc(new Date().toISOString());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//satellite-visibility//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${escapeText(passName(pass))}`,
    `LOCATION:${escapeText(opts.observerName)}`,
    `DESCRIPTION:${describePass(pass)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];
  return lines.join("\r\n");
}

/** Trigger a download of the ICS in the browser. */
export function downloadIcs(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
