import { useMemo } from "react";
import { usePasses } from "@/hooks/use-passes";
import { useObserverStore } from "@/store/observer";
import { useSatelliteStore } from "@/store/satellite";
import { useTimeRangeStore } from "@/store/time-range";
import type { PassesRequest } from "@/types/api";

export function useCurrentPasses() {
  const current = useObserverStore((s) => s.current);
  const query = useSatelliteStore((s) => s.query);
  const { fromUtc, toUtc, mode } = useTimeRangeStore();

  const req = useMemo<PassesRequest | null>(() => {
    if (!query.trim()) return null;
    return {
      lat: current.lat,
      lng: current.lng,
      elevation_m: current.elevation_m,
      query,
      from_utc: fromUtc,
      to_utc: toUtc,
      mode,
    };
  }, [current, query, fromUtc, toUtc, mode]);

  return usePasses(req);
}
