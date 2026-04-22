import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SkyTrackRequest } from "@/types/api";

export function useSkyTrack(req: SkyTrackRequest | null) {
  return useQuery({
    queryKey: ["sky-track", req],
    queryFn: () => api.skyTrack(req!),
    enabled: req !== null,
  });
}
