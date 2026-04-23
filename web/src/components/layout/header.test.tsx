import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { Header } from "@/components/layout/header";

describe("Header", () => {
  it("renders brand and tagline", () => {
    renderWithProviders(<Header />);
    expect(screen.getByText(/Orbit Observer/)).toBeInTheDocument();
    expect(screen.getByText(/Research-grade satellite tracker/i)).toBeInTheDocument();
  });

  it("mounts ChromeCluster (mode toggle pill visible)", () => {
    renderWithProviders(<Header />);
    expect(
      screen.getByRole("button", { name: /Cinematic|Research/i }),
    ).toBeInTheDocument();
  });
});
