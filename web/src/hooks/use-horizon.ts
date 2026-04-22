import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useHorizon(lat: number, lng: number, elevation_m = 0) {
  return useQuery({
    queryKey: ["horizon", lat, lng, elevation_m],
    queryFn: () => api.horizon(lat, lng, elevation_m),
    // Horizon masks are per-location and don't change; cache forever.
    staleTime: Infinity,
  });
}
