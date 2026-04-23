import { useEffect } from "react";
import { Header } from "@/components/layout/header";
import { AppShell } from "@/components/layout/app-shell";
import { ObserverPanel } from "@/components/observer/observer-panel";
import { InputsBar } from "@/components/layout/inputs-bar";
import { RunButton } from "@/components/layout/run-button";
import { PassList } from "@/components/passes/pass-list";
import { TimelineStrip } from "@/components/passes/timeline-strip";
import { TonightCard } from "@/components/passes/tonight-card";
import { HeroPanel } from "@/components/hero/hero-panel";
import { TelemetryRail } from "@/components/telemetry/telemetry-rail";
import { PlaybackBar } from "@/components/playback/playback-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDraftInputsStore } from "@/store/draft-inputs";

/** Today's 3-column dashboard — sky view hero (no earth toggle). */
export function ResearchLayout() {
  // Seed the draft inputs from the committed stores on mount so `isDirty()`
  // starts false regardless of what the zustand module-scope snapshot captured.
  useEffect(() => {
    useDraftInputsStore.getState().initFromCommitted();
  }, []);

  return (
    <>
      <Header />
      <AppShell
        left={
          <>
            <ObserverPanel />
            <InputsBar />
            <RunButton />
          </>
        }
        main={
          <Card>
            <CardHeader>
              <CardTitle>Passes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <TonightCard />
              <TimelineStrip />
              <PassList />
            </CardContent>
          </Card>
        }
        side={
          <>
            <HeroPanel />
            <PlaybackBar />
            <TelemetryRail />
          </>
        }
      />
    </>
  );
}
