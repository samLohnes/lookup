import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { PanelSkyView } from "./panel-sky-view";
import { renderWithProviders } from "@/test/render";

vi.mock("@/components/sky-view/sky-view", () => ({
  SkyView: () => <svg data-testid="sky-view-stub" />,
}));

describe("PanelSkyView", () => {
  it("renders the SkyView child inside the panel section", () => {
    renderWithProviders(<PanelSkyView />);
    expect(screen.getByTestId("sky-view-stub")).toBeInTheDocument();
  });

  it("has a 260px container height", () => {
    const { container } = renderWithProviders(<PanelSkyView />);
    const section = container.firstChild as HTMLElement;
    expect(section.className).toMatch(/h-\[260px\]/);
  });
});
