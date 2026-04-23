import { ChromeCluster } from "@/components/layout/chrome-cluster";

export function Header() {
  return (
    <header className="border-b border-edge bg-bg-raised">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <span className="serif-accent text-xl">Orbit Observer</span>
          <span className="label-upper">Research-grade satellite tracker</span>
        </div>
        <ChromeCluster />
      </div>
    </header>
  );
}
