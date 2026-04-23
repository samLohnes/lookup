import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { TzWarning } from "@/components/observer/tz-warning";
import { server } from "@/test/msw/server";
import { useObserverStore } from "@/store/observer";
import { useDisplayTzStore } from "@/store/display-tz";

beforeEach(() => {
  localStorage.clear();
  useObserverStore.setState({
    current: { lat: 35.6762, lng: 139.6503, elevation_m: 10, name: "Tokyo" },
    saved: [],
  });
  useDisplayTzStore.setState({ mode: "client" });
  server.use(
    http.get("/api/geo/timezone", () =>
      HttpResponse.json({ lat: 35.6762, lng: 139.6503, timezone: "Asia/Tokyo" }),
    ),
  );
});

describe("TzWarning", () => {
  it("renders a banner when client and observer timezones differ", async () => {
    renderWithProviders(<TzWarning />);
    // Tokyo vs the client browser tz (likely America/Los_Angeles in CI,
    // but whatever it is, it differs from Tokyo). The warning appears.
    expect(await screen.findByText(/Observer is/)).toBeInTheDocument();
  });

  it("clicking the button switches display to observer time", async () => {
    renderWithProviders(<TzWarning />);
    const btn = await screen.findByRole("button", { name: /Switch to observer/ });
    await userEvent.click(btn);
    expect(useDisplayTzStore.getState().mode).toBe("observer");
  });

  it("renders nothing when observer tz equals client tz", async () => {
    const client = Intl.DateTimeFormat().resolvedOptions().timeZone;
    server.use(
      http.get("/api/geo/timezone", () =>
        HttpResponse.json({ lat: 0, lng: 0, timezone: client }),
      ),
    );
    const { container } = renderWithProviders(<TzWarning />);
    // Wait for fetch.
    await new Promise((r) => setTimeout(r, 40));
    expect(container.textContent).toBe("");
  });

  it("renders nothing when mode is already observer", async () => {
    useDisplayTzStore.setState({ mode: "observer" });
    const { container } = renderWithProviders(<TzWarning />);
    await new Promise((r) => setTimeout(r, 40));
    expect(container.textContent).toBe("");
  });
});
