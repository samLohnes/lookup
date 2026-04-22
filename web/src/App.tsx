import { Header } from "@/components/layout/header";
import { AppShell } from "@/components/layout/app-shell";
import { ObserverPanel } from "@/components/observer/observer-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function App() {
  return (
    <>
      <Header />
      <AppShell
        left={<ObserverPanel />}
        main={
          <Card>
            <CardHeader>
              <CardTitle>Passes</CardTitle>
            </CardHeader>
            <CardContent className="text-fg-muted">
              Coming in the next task.
            </CardContent>
          </Card>
        }
        side={
          <Card>
            <CardHeader>
              <CardTitle>Sky view</CardTitle>
            </CardHeader>
            <CardContent className="text-fg-muted">Coming later.</CardContent>
          </Card>
        }
      />
    </>
  );
}
