import { Header } from "@/components/layout/header";
import { AppShell } from "@/components/layout/app-shell";
import { ObserverPanel } from "@/components/observer/observer-panel";
import { InputsBar } from "@/components/layout/inputs-bar";
import { PassList } from "@/components/passes/pass-list";
import { TimelineStrip } from "@/components/passes/timeline-strip";
import { SkyView } from "@/components/sky-view/sky-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function App() {
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
              <TimelineStrip />
              <PassList />
            </CardContent>
          </Card>
        }
        side={
          <Card>
            <CardHeader>
              <CardTitle>Sky view</CardTitle>
            </CardHeader>
            <CardContent>
              <SkyView />
            </CardContent>
          </Card>
        }
      />
    </>
  );
}
