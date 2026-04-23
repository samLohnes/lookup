import { useObserverTimezone } from "@/hooks/use-observer-timezone";
import { useDisplayTzStore } from "@/store/display-tz";
import { clientTimezone, tzOffsetMinutes } from "@/lib/format-time";

/** Extract a human-readable city/zone name from an IANA string.
 *  `"America/New_York"` → `"New York"`; `"Etc/UTC"` → `"UTC"`. */
function cityFromTz(tz: string): string {
  const last = tz.split("/").pop() ?? tz;
  return last.replace(/_/g, " ");
}

/** Describe how many hours the observer tz is offset from the client tz. */
function offsetPhrase(mins: number): string {
  const absH = Math.abs(mins) / 60;
  const rounded = Number.isInteger(absH) ? `${absH} h` : `${absH.toFixed(1)} h`;
  return mins > 0 ? `${rounded} ahead of you` : `${rounded} behind you`;
}

/** Inline note shown in the observer panel when the observer's timezone
 *  differs from the client's and the user hasn't yet switched display mode.
 *
 *  Treated as an informative hint — not an alert. Uses a subtle left-border
 *  accent instead of a filled banner, with a text-link action.
 */
export function TzWarning() {
  const { data, isFetching } = useObserverTimezone();
  const mode = useDisplayTzStore((s) => s.mode);
  const setMode = useDisplayTzStore((s) => s.setMode);

  if (isFetching || !data) return null;
  const client = clientTimezone();
  const observer = data.timezone;
  if (observer === client) return null;
  if (mode === "observer" || mode === "utc") return null;

  const diffMin = tzOffsetMinutes(observer, client);

  return (
    <div className="border-l-2 border-observer/60 pl-3 py-0.5 space-y-1">
      <p className="text-xs leading-snug">
        Observer is{" "}
        <span className="text-observer">{offsetPhrase(diffMin)}</span>
      </p>
      <p className="text-[10px] text-fg-subtle tabular-nums leading-snug">
        {cityFromTz(observer)} <span className="text-fg-subtle/60">(observer)</span>
        {" · "}
        {cityFromTz(client)} <span className="text-fg-subtle/60">(you)</span>
      </p>
      <button
        type="button"
        onClick={() => setMode("observer")}
        className="text-xs text-observer hover:underline focus-visible:outline-none focus-visible:underline"
      >
        Switch to observer time →
      </button>
    </div>
  );
}
