import { useObserverTimezone } from "@/hooks/use-observer-timezone";
import { useDisplayTzStore } from "@/store/display-tz";
import { clientTimezone, tzOffsetMinutes } from "@/lib/format-time";
import { Button } from "@/components/ui/button";

/** Describe how many hours the observer tz is offset from the client tz.
 *  Returns "matches" if zero, otherwise e.g. "9 h ahead of you". */
function offsetSentence(mins: number): string {
  if (mins === 0) return "matches";
  const absH = Math.abs(mins) / 60;
  const rounded = Number.isInteger(absH) ? `${absH} h` : `${absH.toFixed(1)} h`;
  return mins > 0 ? `${rounded} ahead of you` : `${rounded} behind you`;
}

/** Warning banner shown in the observer panel when the observer's timezone
 *  differs from the client's timezone and the user has not yet switched to
 *  observer or UTC display mode. */
export function TzWarning() {
  const { data, isFetching } = useObserverTimezone();
  const mode = useDisplayTzStore((s) => s.mode);
  const setMode = useDisplayTzStore((s) => s.setMode);

  if (isFetching || !data) return null;
  const client = clientTimezone();
  const observer = data.timezone;
  if (observer === client) return null;
  if (mode === "observer" || mode === "utc") return null; // user already reconciled

  const diffMin = tzOffsetMinutes(observer, client);

  return (
    <div className="text-xs px-3 py-2 rounded-card bg-observer/10 border border-observer/40 flex items-center justify-between gap-3">
      <span>
        ⚠ Observer is <strong>{offsetSentence(diffMin)}</strong> ({observer} vs {client}).
      </span>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setMode("observer")}
      >
        Switch to observer time
      </Button>
    </div>
  );
}
