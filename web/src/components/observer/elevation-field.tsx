import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { useObserverElevation } from "@/hooks/use-observer-elevation";
import { useDraftInputsStore } from "@/store/draft-inputs";
import { cssTransition } from "@/lib/motion";

/** Observer elevation (m above sea level) — auto-populated from DEM lookup
 *  at the observer's lat/lng, with a manual override path for researchers
 *  with elevated instruments.
 *
 *  States:
 *    - lookup in flight  → "looking up" chip, em-dash value
 *    - lookup succeeded + draft matches  → "auto" chip, value in Fraunces
 *    - lookup succeeded + draft differs  → "overridden" chip (amber)
 *    - lookup failed     → "unknown" chip, draft value shown as-is */
export function ElevationField() {
  const draftObserver = useDraftInputsStore((s) => s.draft.observer);
  const setDraftObserver = useDraftInputsStore((s) => s.setDraftObserver);
  const { data, isFetching, isError } = useObserverElevation(
    draftObserver.lat,
    draftObserver.lng,
  );

  // Auto-populate draft's elevation_m on fresh lat/lng lookups. If the
  // draft already has a user-specified value that disagrees with the
  // lookup, record the key without writing — the user's intent wins.
  const lastWrittenKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!data) return;
    const key = `${data.lat},${data.lng}`;
    if (lastWrittenKeyRef.current === key) return;
    lastWrittenKeyRef.current = key;
    const draftDiffers =
      Math.abs(draftObserver.elevation_m - data.elevation_m) >= 0.5;
    const draftIsInitial = draftObserver.elevation_m === 0;
    if (draftDiffers && !draftIsInitial) return;
    setDraftObserver({ ...draftObserver, elevation_m: data.elevation_m });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  // Override UI state.
  const [editing, setEditing] = useState(false);
  const [pendingValue, setPendingValue] = useState<string>(
    String(draftObserver.elevation_m),
  );

  const confirmOverride = () => {
    const parsed = Number(pendingValue);
    if (!Number.isFinite(parsed)) {
      setEditing(false);
      return;
    }
    setDraftObserver({ ...draftObserver, elevation_m: parsed });
    setEditing(false);
  };

  const cancelOverride = () => {
    setPendingValue(String(draftObserver.elevation_m));
    setEditing(false);
  };

  const resetToAuto = () => {
    if (!data) return;
    setDraftObserver({ ...draftObserver, elevation_m: data.elevation_m });
  };

  // Derive display state.
  let chipLabel: string;
  let chipClass: string;
  if (isFetching) {
    chipLabel = "looking up…";
    chipClass = "bg-white/5 text-[#8a7c68] border-white/10";
  } else if (isError) {
    chipLabel = "unknown";
    chipClass = "bg-white/5 text-[#8a7c68] border-white/10";
  } else if (data && Math.abs(draftObserver.elevation_m - data.elevation_m) < 0.5) {
    chipLabel = "auto";
    chipClass = "bg-white/5 text-[#8a7c68] border-white/10";
  } else {
    chipLabel = "overridden";
    chipClass = "bg-accent-400/14 text-accent-200 border-accent-400/30";
  }

  const formatted = new Intl.NumberFormat("en-US").format(
    Math.round(draftObserver.elevation_m),
  );

  return (
    <div className="rounded-md border border-accent-400/12 bg-white/[0.02] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-serif text-[13px] font-medium text-[#e8d8c0]">
          Elevation
        </div>
        <span
          className={`inline-block text-[9px] uppercase tracking-[0.1em] font-semibold px-2 py-0.5 rounded border ${chipClass}`}
        >
          {chipLabel}
        </span>
      </div>
      <div>
        <div className="font-serif text-[28px] font-medium text-[#e8d8c0] leading-none tabular-nums">
          {isFetching ? "— m" : `${formatted} m`}
        </div>
        <div className="text-[11px] text-[#8a7c68] mt-1">
          {isError
            ? "Set manually below."
            : "Sampled from terrain at this point."}
        </div>
      </div>

      <div className="pt-2 border-t border-accent-400/10">
        {editing ? (
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step={1}
              value={pendingValue}
              onChange={(e) => setPendingValue(e.target.value)}
              className="flex-1 font-mono tabular-nums"
              aria-label="Override elevation in metres"
            />
            <span className="text-[10px] text-[#8a7c68]">m</span>
            <button
              type="button"
              onClick={confirmOverride}
              aria-label="Confirm override"
              className="w-7 h-7 rounded grid place-items-center bg-accent-400/14 border border-accent-400/30 text-accent-200 hover:bg-accent-400/22"
              style={{ transition: cssTransition("background", "fast") }}
            >
              ✓
            </button>
            <button
              type="button"
              onClick={cancelOverride}
              aria-label="Cancel override"
              className="w-7 h-7 rounded grid place-items-center bg-white/5 border border-white/10 text-[#8a7c68] hover:bg-white/10"
              style={{ transition: cssTransition("background", "fast") }}
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPendingValue(String(Math.round(draftObserver.elevation_m)));
                setEditing(true);
              }}
              className="text-[11px] text-[#c5a888] hover:text-accent-200"
              style={{ transition: cssTransition("color", "fast") }}
            >
              Override elevation
            </button>
            {chipLabel === "overridden" && data ? (
              <>
                <span className="text-[#6a5d48]">·</span>
                <button
                  type="button"
                  onClick={resetToAuto}
                  className="text-[11px] text-[#8a7c68] hover:text-accent-200"
                  style={{ transition: cssTransition("color", "fast") }}
                >
                  Reset to terrain
                </button>
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
