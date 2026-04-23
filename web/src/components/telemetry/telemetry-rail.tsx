import { useTrackAtCursor } from "@/hooks/use-track-at-cursor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RowProps {
  label: string;
  value: string;
}

/** A single label/value row in the telemetry table. */
function Row({ label, value }: RowProps) {
  return (
    <div className="flex justify-between text-xs py-0.5">
      <span className="text-fg-muted">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Sidebar card displaying live telemetry for the playback cursor position. */
export function TelemetryRail() {
  const { sample, isLoading } = useTrackAtCursor();

  if (!sample) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Telemetry</CardTitle>
        </CardHeader>
        <CardContent className="text-fg-muted text-xs">
          {isLoading ? "Loading…" : "Select a pass and press play to see telemetry."}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Telemetry</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <Row
          label="Time (local)"
          value={new Date(sample.time).toLocaleTimeString()}
        />
        <Row label="Altitude" value={`${sample.alt_km.toFixed(1)} km`} />
        <Row label="Range" value={`${sample.range_km.toFixed(0)} km`} />
        <Row label="Velocity" value={`${sample.velocity_km_s.toFixed(2)} km/s`} />
        <Row label="Az / El" value={`${sample.az.toFixed(0)}° / ${sample.el.toFixed(1)}°`} />
        <Row
          label="Magnitude"
          value={sample.magnitude != null ? sample.magnitude.toFixed(1) : "—"}
        />
        <Row label="Sunlit" value={sample.sunlit ? "yes" : "no (eclipsed)"} />
        <Row
          label="Observer dark"
          value={sample.observer_dark ? "yes" : "no"}
        />
      </CardContent>
    </Card>
  );
}
