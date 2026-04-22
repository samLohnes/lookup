import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useCatalogSearch(q: string) {
  return useQuery({
    queryKey: ["catalog-search", q],
    queryFn: () => api.catalogSearch(q),
    enabled: q.length > 0,
    staleTime: 30_000,
  });
}
