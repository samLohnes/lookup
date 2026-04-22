import { useSatelliteStore } from "@/store/satellite";
import { useTleFreshness } from "@/hooks/use-tle-freshness";

export function Header() {
  const query = useSatelliteStore((s) => s.query);
  const { data } = useTleFreshness(query);
  const epochLine = data?.[0]
    ? `${data[0].name} · TLE ${formatAge(data[0].fetched_age_seconds)} old`
    : null;

  return (
    <header className="border-b border-edge bg-bg-raised">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="serif-accent text-xl">Orbit Observer</span>
          <span className="label-upper">Research-grade satellite tracker</span>
        </div>
        <div className="text-xs text-fg-muted">
          {epochLine ?? "Satellite: none selected"}
        </div>
      </div>
    </header>
  );
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)} s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h`;
  return `${Math.floor(seconds / 86400)} d`;
}
