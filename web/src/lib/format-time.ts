import type { DisplayTzMode } from "@/store/display-tz";

/** The IANA timezone of the client (user's browser/system). */
export function clientTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

/** Resolve the active IANA timezone for a given display mode. */
export function resolveDisplayTimezone(
  mode: DisplayTzMode,
  observerTimezone: string | null,
): string {
  if (mode === "utc") return "UTC";
  if (mode === "observer") return observerTimezone ?? clientTimezone();
  return clientTimezone();
}

/** Format an ISO-UTC timestamp in the active display timezone.
 *
 *  `mode` picks which timezone to use (client/observer/utc). If mode is
 *  "observer" but `observerTimezone` hasn't resolved yet (still fetching),
 *  falls back to client timezone to avoid blank cells.
 */
export function formatTimeInTz(
  iso: string,
  mode: DisplayTzMode,
  observerTimezone: string | null,
  options: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  },
): string {
  const tz = resolveDisplayTimezone(mode, observerTimezone);
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: tz }).format(
    new Date(iso),
  );
}

/** Format an ISO-UTC timestamp as a full date + time in the active tz. */
export function formatDateTimeInTz(
  iso: string,
  mode: DisplayTzMode,
  observerTimezone: string | null,
): string {
  return formatTimeInTz(iso, mode, observerTimezone, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Offset in minutes between two IANA timezones at a given instant.
 *  Positive if `a` is ahead of `b`. */
export function tzOffsetMinutes(
  a: string,
  b: string,
  at: Date = new Date(),
): number {
  // Format the same instant in both zones and diff the parts.
  const atMs = at.getTime();
  const inZone = (z: string) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: z,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).formatToParts(new Date(atMs));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    // Reconstruct a UTC ms from the wall-clock digits in zone z.
    return Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") === 24 ? 0 : get("hour"),
      get("minute"),
      get("second"),
    );
  };
  return Math.round((inZone(a) - inZone(b)) / 60000);
}

/** Extract a date's Y-M-D in a given tz as a stable comparison key. */
function ymdInTz(iso: string, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Extract a date's hour (0-23) in a given tz. */
function hourInTz(iso: string, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  return h === 24 ? 0 : h;
}

/** Format an hour-minute in compact style: "6p", "6:30a", "12p". */
function compactHourMinute(iso: string, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric", minute: "2-digit", hour12: true,
  }).formatToParts(new Date(iso));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const period = (parts.find((p) => p.type === "dayPeriod")?.value ?? "")
    .toLowerCase()
    .charAt(0); // 'a' or 'p'
  if (minute === "00") return `${hour}${period}`;
  return `${hour}:${minute}${period}`;
}

/** Format a window (start, end) for the config chip value slot.
 *  "Tonight 6p–6a" if the window starts today (display tz) and ends
 *  before noon the next day. Otherwise "Apr 24 · 6p–6a". */
export function formatWindowChip(
  startIso: string,
  endIso: string,
  mode: DisplayTzMode,
  observerTimezone: string | null,
): string {
  const tz = resolveDisplayTimezone(mode, observerTimezone);
  const startYmd = ymdInTz(startIso, tz);
  const endYmd = ymdInTz(endIso, tz);
  const endHour = hourInTz(endIso, tz);

  const startTime = compactHourMinute(startIso, tz);
  const endTime = compactHourMinute(endIso, tz);

  // "Tonight" rule: same-day start, end is either same-day or next-day before noon.
  const sameDay = startYmd === endYmd;
  const nextDayBeforeNoon =
    !sameDay &&
    endHour < 12 &&
    dayDiff(startYmd, endYmd) === 1;

  if (sameDay || nextDayBeforeNoon) {
    return `Tonight ${startTime}–${endTime}`;
  }

  const dateLabel = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "short", day: "numeric",
  }).format(new Date(startIso));
  return `${dateLabel} · ${startTime}–${endTime}`;
}

/** Day difference between two YYYY-MM-DD strings (a minus b). */
function dayDiff(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const aMs = Date.UTC(ay, am - 1, ad);
  const bMs = Date.UTC(by, bm - 1, bd);
  return Math.round((bMs - aMs) / 86_400_000);
}
