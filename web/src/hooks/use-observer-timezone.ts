import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useObserverStore } from "@/store/observer";

/** Returns the IANA timezone at the current observer's lat/lng.
 *
 *  Cached aggressively — a location's timezone doesn't change. 24 h stale
 *  time is enough to survive the lifetime of any single app session.
 */
export function useObserverTimezone() {
  const current = useObserverStore((s) => s.current);
  return useQuery({
    queryKey: ["observer-timezone", current.lat, current.lng],
    queryFn: () => api.geoTimezone(current.lat, current.lng),
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}
