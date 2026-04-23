import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkyView } from "@/components/sky-view/sky-view";
import { EarthView } from "@/components/earth-view/earth-view";
import { HeroToggle } from "@/components/hero/hero-toggle";

export function HeroPanel() {
  const [hero, setHero] = useState<"sky" | "earth">("sky");
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{hero === "sky" ? "Sky view" : "Earth view"}</CardTitle>
        <HeroToggle hero={hero} onChange={setHero} />
      </CardHeader>
      <CardContent>
        {hero === "sky" ? <SkyView /> : <EarthView />}
      </CardContent>
    </Card>
  );
}
