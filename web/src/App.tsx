import { Header } from "@/components/layout/header";
import { AppShell } from "@/components/layout/app-shell";
import { ObserverPanel } from "@/components/observer/observer-panel";
import { InputsBar } from "@/components/layout/inputs-bar";
import { PassList } from "@/components/passes/pass-list";
import { TimelineStrip } from "@/components/passes/timeline-strip";
import { TonightCard } from "@/components/passes/tonight-card";
import { HeroPanel } from "@/components/hero/hero-panel";
import { TelemetryRail } from "@/components/telemetry/telemetry-rail";
import { PlaybackBar } from "@/components/playback/playback-bar";
import { useCursorReset } from "@/hooks/use-cursor-reset";
import { usePlaybackLoop } from "@/hooks/use-playback-loop";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function App() {
  // Wire global side-effects once.
  useCursorReset();
  usePlaybackLoop();

  return (
    <>
      <Header />
      <AppShell
        left={
          <>
            <ObserverPanel />
            <InputsBar />
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
