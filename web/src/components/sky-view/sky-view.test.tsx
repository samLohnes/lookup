import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@/test/render";
import { SkyView } from "@/components/sky-view/sky-view";
import { useObserverStore } from "@/store/observer";

describe("SkyView", () => {
  it("renders the SVG dome with all four cardinal compass labels", () => {
    useObserverStore.setState({
      current: { lat: 40.7128, lng: -74.006, elevation_m: 10, name: "NYC" },
      saved: [],
    });
    const { container } = renderWithProviders(<SkyView />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    const text = container.textContent ?? "";
    expect(text).toContain("N");
    expect(text).toContain("E");
    expect(text).toContain("S");
    expect(text).toContain("W");
  });
});
