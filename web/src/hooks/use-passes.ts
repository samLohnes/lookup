import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { PassesRequest } from "@/types/api";

export function usePasses(req: PassesRequest | null) {
  return useQuery({
    queryKey: ["passes", req],
    queryFn: () => api.passes(req!),
    enabled: req !== null && req.query.length > 0,
  });
}
