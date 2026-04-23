import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTonightSummary } from "@/hooks/use-tonight-summary";
import { useSelectionStore } from "@/store/selection";

/** Displays a summary of tonight's visible passes: count, brightest, highest. */
export function TonightCard() {
  const summary = useTonightSummary();
  const select = useSelectionStore((s) => s.select);

  if (!summary) return null;

  return (
    <Card className="border-satellite/40 bg-satellite/5">
      <CardHeader>
        <CardTitle className="serif-accent">Tonight</CardTitle>
        <p className="text-xs text-fg-muted">{summary.windowLabel}</p>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div>
          <span className="label-upper">Visible passes:</span>{" "}
          <span className="tabular-nums">{summary.count}</span>
        </div>
        {summary.brightest && (
          <button
            className="block text-left hover:underline"
            onClick={() => select(summary.brightest!.id)}
          >
            <span className="label-upper">Brightest:</span>{" "}
            {summary.brightest.name} ·{" "}
            {summary.brightest.max_magnitude != null
              ? `mag ${summary.brightest.max_magnitude.toFixed(1)}`
              : ""}
          </button>
        )}
        {summary.highest && (
          <button
            className="block text-left hover:underline"
            onClick={() => select(summary.highest!.id)}
          >
            <span className="label-upper">Highest:</span>{" "}
            {summary.highest.name} ·{" "}
            {summary.highest.peak.elevation_deg.toFixed(0)}°
          </button>
        )}
      </CardContent>
    </Card>
  );
}
