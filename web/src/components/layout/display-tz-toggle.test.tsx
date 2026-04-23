import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { DisplayTzToggle } from "@/components/layout/display-tz-toggle";
import { server } from "@/test/msw/server";
import { useObserverStore } from "@/store/observer";
import { useDisplayTzStore } from "@/store/display-tz";

beforeEach(() => {
  localStorage.clear();
  useObserverStore.setState({
    current: { lat: 40.7128, lng: -74.006, elevation_m: 10, name: "NYC" },
    saved: [],
  });
  useDisplayTzStore.setState({ mode: "client" });
  server.use(
    http.get("/api/geo/timezone", () =>
      HttpResponse.json({ lat: 40.7128, lng: -74.006, timezone: "America/New_York" }),
    ),
  );
});

describe("DisplayTzToggle", () => {
  it("renders Client, Observer, and UTC buttons", async () => {
    renderWithProviders(<DisplayTzToggle />);
    // Observer label resolves once the hook returns.
    expect(await screen.findByRole("button", { name: /Observer \(New York/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Client/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "UTC" })).toBeInTheDocument();
  });

  it("clicking UTC sets mode to utc", async () => {
    renderWithProviders(<DisplayTzToggle />);
    await userEvent.click(screen.getByRole("button", { name: "UTC" }));
    expect(useDisplayTzStore.getState().mode).toBe("utc");
  });
});
