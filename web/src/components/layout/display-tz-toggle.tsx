import { Button } from "@/components/ui/button";
import { useDisplayTzStore, type DisplayTzMode } from "@/store/display-tz";
import { useObserverTimezone } from "@/hooks/use-observer-timezone";
import { clientTimezone, tzOffsetMinutes } from "@/lib/format-time";

/** Shorten an IANA tz string to a human-readable city/region label.
 *  "America/New_York" → "New York"; "Etc/UTC" → "UTC". */
function shortTzLabel(tz: string): string {
  const last = tz.split("/").pop() ?? tz;
  return last.replace(/_/g, " ");
}

/** Format a signed hour offset as "+2h", "−5.5h", etc. Empty string if zero. */
function offsetLabel(mins: number): string {
  if (mins === 0) return "";
  const sign = mins > 0 ? "+" : "−";
  const h = Math.abs(mins) / 60;
  const rounded = Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
  return `${sign}${rounded}`;
}

/** Three-button toggle for choosing which timezone to display times in. */
export function DisplayTzToggle() {
  const mode = useDisplayTzStore((s) => s.mode);
  const setMode = useDisplayTzStore((s) => s.setMode);
  const { data: observerTz } = useObserverTimezone();
  const client = clientTimezone();
  const observer = observerTz?.timezone ?? null;

  const clientLabel = `Client (${shortTzLabel(client)})`;
  const observerLabel = observer
    ? `Observer (${shortTzLabel(observer)}${
        tzOffsetMinutes(observer, client) !== 0
          ? `, ${offsetLabel(tzOffsetMinutes(observer, client))}`
          : ""
      })`
    : "Observer";

  function render(m: DisplayTzMode, label: string, disabled = false) {
    return (
      <Button
        key={m}
        variant={mode === m ? "default" : "outline"}
        size="sm"
        onClick={() => setMode(m)}
        disabled={disabled}
      >
        {label}
      </Button>
    );
  }

  return (
    <div
      className="flex gap-1 items-center"
      role="group"
      aria-label="Display timezone"
    >
      <span className="label-upper mr-2">Times</span>
      {render("client", clientLabel)}
      {render("observer", observerLabel, !observer)}
      {render("utc", "UTC")}
    </div>
  );
}
