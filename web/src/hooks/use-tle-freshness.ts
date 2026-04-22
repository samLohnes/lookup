import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useTleFreshness(query: string) {
  return useQuery({
    queryKey: ["tle-freshness", query],
    queryFn: () => api.tleFreshness(query),
    enabled: query.length > 0,
    staleTime: 60_000,
  });
}
