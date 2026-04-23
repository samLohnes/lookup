import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkyView } from "@/components/sky-view/sky-view";

/** Research-mode hero: permanent sky view. Earth view in M6+ is cinematic-only. */
export function HeroPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sky view</CardTitle>
      </CardHeader>
      <CardContent>
        <SkyView />
      </CardContent>
    </Card>
  );
}
