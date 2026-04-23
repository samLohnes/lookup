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
