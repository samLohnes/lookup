import { lazy, Suspense, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkyView } from "@/components/sky-view/sky-view";
import { HeroToggle } from "@/components/hero/hero-toggle";
import { EarthViewLoader } from "@/components/hero/earth-view-loader";

// Three.js is heavy (~600 KB). Keep the sky-only code path lean by only
// loading the earth chunk when the user swaps to the Earth hero.
const EarthView = lazy(() =>
  import("@/components/earth-view/earth-view").then((m) => ({
    default: m.EarthView,
  })),
);

export function HeroPanel() {
  const [hero, setHero] = useState<"sky" | "earth">("sky");
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{hero === "sky" ? "Sky view" : "Earth view"}</CardTitle>
        <HeroToggle hero={hero} onChange={setHero} />
      </CardHeader>
      <CardContent>
        {hero === "sky" ? (
          <SkyView />
        ) : (
          <Suspense fallback={<EarthViewLoader />}>
            <EarthView />
          </Suspense>
        )}
      </CardContent>
    </Card>
  );
}
