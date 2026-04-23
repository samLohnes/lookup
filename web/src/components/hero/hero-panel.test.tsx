import { describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "@/test/render";
import { HeroPanel } from "@/components/hero/hero-panel";

// Stub EarthView so the test doesn't try to spin up Three.js in jsdom.
vi.mock("@/components/earth-view/earth-view", () => ({
  EarthView: () => <div data-testid="earth-stub">EarthView</div>,
}));

describe("HeroPanel", () => {
  it("starts on the sky view", () => {
    renderWithProviders(<HeroPanel />);
    expect(screen.getByText("Sky view")).toBeInTheDocument();
    expect(screen.queryByTestId("earth-stub")).toBeNull();
  });

  it("clicking the Earth toggle swaps the hero", async () => {
    renderWithProviders(<HeroPanel />);
    await userEvent.click(screen.getByRole("button", { name: "Earth" }));
    expect(screen.getByText("Earth view")).toBeInTheDocument();
    expect(screen.getByTestId("earth-stub")).toBeInTheDocument();
  });
});
