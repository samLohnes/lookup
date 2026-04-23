import { describe, expect, it, beforeEach } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { ChromeCluster } from "./chrome-cluster";
import { useAppModeStore } from "@/store/app-mode";
import { useTimeRangeStore } from "@/store/time-range";

describe("ChromeCluster", () => {
  beforeEach(() => {
    useAppModeStore.setState({ mode: "cinematic" });
    useTimeRangeStore.setState({ mode: "line-of-sight" } as never);
  });

  it("renders all three pills", () => {
    renderWithProviders(<ChromeCluster />);
    expect(screen.getByRole("button", { name: /Cinematic|Research/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Line-of-sight|Naked-eye/i })).toBeInTheDocument();
    expect(screen.getAllByText(/(Client|Observer|UTC)/i).length).toBeGreaterThan(0);
  });
});
