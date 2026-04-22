import { Header } from "@/components/layout/header";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function App() {
  return (
    <>
      <Header />
      <AppShell
        left={
          <Card>
            <CardHeader>
              <CardTitle>Observer</CardTitle>
            </CardHeader>
            <CardContent className="text-fg-muted">
              Location, satellite, and time will live here.
            </CardContent>
          </Card>
        }
        main={
          <Card>
            <CardHeader>
              <CardTitle>Passes</CardTitle>
            </CardHeader>
            <CardContent className="text-fg-muted">
              Timeline + pass list.
            </CardContent>
          </Card>
        }
        side={
          <Card>
            <CardHeader>
              <CardTitle>Sky view</CardTitle>
            </CardHeader>
            <CardContent className="text-fg-muted">
              The alt-az dome.
            </CardContent>
          </Card>
        }
      />
    </>
  );
}
