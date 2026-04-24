import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useObserverElevation } from "@/hooks/use-observer-elevation";
import { useDraftInputsStore } from "@/store/draft-inputs";

/** Editable observer elevation (m above sea level) with DEM auto-lookup.
 *
 *  Behaviour:
 *    1. When the draft observer's lat/lng changes, fetches the terrain
 *       elevation at that point (cached forever per coord pair).
 *    2. Writes the lookup result into the draft's `elevation_m` — but
 *       only on a fresh lookup for a new coord pair (tracked via
 *       `lastWrittenKeyRef`). This lets the user manually override the
 *       value afterwards without it being clobbered by the same query
 *       result re-resolving from cache.
 *    3. Exposes a "Reset to ground level" button that re-applies the
 *       last lookup result on demand.
 *
 *  Auto-population is a "fresh start" each time the observer moves —
 *  if the user moves to a new mountain, we want their elevation to
 *  match the new terrain, not stay at the previous override.
 */
export function ElevationField() {
  const draftObserver = useDraftInputsStore((s) => s.draft.observer);
  const setDraftObserver = useDraftInputsStore((s) => s.setDraftObserver);
  const { data, isFetching, isError } = useObserverElevation(
    draftObserver.lat,
    draftObserver.lng,
  );

  // Track the last lat/lng we auto-populated for, so we don't clobber a
  // user's manual edit when the cached query re-resolves on re-render.
  const lastWrittenKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (data === undefined) return;
    const key = `${data.lat},${data.lng}`;
    if (lastWrittenKeyRef.current === key) return;
    lastWrittenKeyRef.current = key;
    setDraftObserver({ ...draftObserver, elevation_m: data.elevation_m });
    // Intentionally only depends on `data` (and the setter): we want the
    // write to fire exactly once per fresh lat/lng lookup, not every
    // time `draftObserver` changes (e.g. the user editing the field).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const handleChange = (value: string) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return;
    setDraftObserver({ ...draftObserver, elevation_m: parsed });
  };

  const handleReset = () => {
    if (data === undefined) return;
    setDraftObserver({ ...draftObserver, elevation_m: data.elevation_m });
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="elevation">Elevation (m)</Label>
      <div className="flex items-center gap-2">
        <Input
          id="elevation"
          type="number"
          step={1}
          value={draftObserver.elevation_m}
          onChange={(e) => handleChange(e.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={data === undefined}
          onClick={handleReset}
          title="Reset to DEM-sampled ground level"
        >
          Reset
        </Button>
      </div>
      {isFetching && (
        <p className="text-xs text-fg-muted">(looking up…)</p>
      )}
      {isError && !isFetching && (
        <p className="text-xs text-fg-muted">
          (elevation unknown — defaulting to {draftObserver.elevation_m} m)
        </p>
      )}
    </div>
  );
}
