import { useMemo } from "react";
import { useSkyTrack } from "@/hooks/use-sky-track";
import { useCurrentPasses } from "@/hooks/use-current-passes";
import { useObserverStore } from "@/store/observer";
import { useSatelliteStore } from "@/store/satellite";
import { useSelectionStore } from "@/store/selection";
import type { SkyTrackRequest } from "@/types/api";

/** Returns dense trajectory samples for the currently selected pass, or idle if none selected. */
export function useCurrentSkyTrack() {
  const current = useObserverStore((s) => s.current);
  const query = useSatelliteStore((s) => s.query);
  const selectedId = useSelectionStore((s) => s.selectedPassId);
  const { data: passes } = useCurrentPasses();

  const req = useMemo<SkyTrackRequest | null>(() => {
    if (!passes || !selectedId) return null;
    const pass = passes.passes.find((p) => p.id === selectedId);
    if (!pass) return null;
    return {
      lat: current.lat,
      lng: current.lng,
      elevation_m: current.elevation_m,
      query,
      from_utc: pass.rise.time,
      to_utc: pass.set.time,
      dt_seconds: 2,
    };
  }, [current, query, selectedId, passes]);

  return useSkyTrack(req);
}
