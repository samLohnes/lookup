import { useCurrentPasses } from "@/hooks/use-current-passes";
import { PassCard } from "@/components/passes/pass-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api";

export function PassList() {
  const { data, isFetching, error } = useCurrentPasses();

  if (isFetching && !data) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    );
  }

  if (error) {
    const detail = error instanceof ApiError ? error.detail : String(error);
    return (
      <div className="p-4 rounded-card border border-danger/50 bg-danger/5 text-danger text-sm">
        {detail}
      </div>
    );
  }

  if (!data || data.passes.length === 0) {
    return (
      <div className="p-6 text-sm text-fg-muted">
        No visible passes in the selected window.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="label-upper">
        {data.passes.length} pass{data.passes.length === 1 ? "" : "es"} ·{" "}
        {data.resolved_name}
      </div>
      {data.passes.map((p) => (
        <PassCard key={p.id} pass={p} />
      ))}
    </div>
  );
}
