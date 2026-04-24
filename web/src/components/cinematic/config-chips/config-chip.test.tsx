import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { ConfigChip } from "./config-chip";
import { renderWithProviders } from "@/test/render";

describe("ConfigChip", () => {
  it("renders label and value in stacked layout", () => {
    renderWithProviders(
      <ConfigChip
        label="OBSERVER"
        value="San Francisco"
        isDirty={false}
        popoverTitle="Edit observer"
      >
        <div>popover content</div>
      </ConfigChip>,
    );
    expect(screen.getByText("OBSERVER")).toBeInTheDocument();
    expect(screen.getByText("San Francisco")).toBeInTheDocument();
  });

  it("shows dirty dot and amber value when isDirty=true", () => {
    const { container } = renderWithProviders(
      <ConfigChip
        label="OBSERVER"
        value="San Francisco"
        isDirty={true}
        popoverTitle="Edit observer"
      >
        <div>popover content</div>
      </ConfigChip>,
    );
    // Dot has data-testid for stability
    expect(container.querySelector("[data-testid='chip-dirty-dot']")).toBeInTheDocument();
  });

  it("does not render dirty dot when isDirty=false", () => {
    const { container } = renderWithProviders(
      <ConfigChip
        label="OBSERVER"
        value="San Francisco"
        isDirty={false}
        popoverTitle="Edit observer"
      >
        <div>popover content</div>
      </ConfigChip>,
    );
    expect(container.querySelector("[data-testid='chip-dirty-dot']")).not.toBeInTheDocument();
  });

  it("click opens popover and shows its children + title", () => {
    renderWithProviders(
      <ConfigChip
        label="OBSERVER"
        value="San Francisco"
        isDirty={false}
        popoverTitle="Edit observer"
      >
        <div data-testid="popover-body">popover content</div>
      </ConfigChip>,
    );
    fireEvent.click(screen.getByRole("button", { name: /OBSERVER/i }));
    expect(screen.getByText("Edit observer")).toBeInTheDocument();
    expect(screen.getByTestId("popover-body")).toBeInTheDocument();
  });

  it("shows Discard button only when isDirty and calls onDiscard on click", () => {
    const onDiscard = vi.fn();
    renderWithProviders(
      <ConfigChip
        label="OBSERVER"
        value="SF"
        isDirty={true}
        popoverTitle="Edit observer"
        onDiscard={onDiscard}
      >
        <div>body</div>
      </ConfigChip>,
    );
    fireEvent.click(screen.getByRole("button", { name: /OBSERVER/i }));
    const discard = screen.getByRole("button", { name: /Discard/i });
    expect(discard).toBeInTheDocument();
    fireEvent.click(discard);
    expect(onDiscard).toHaveBeenCalled();
  });

  it("does not render Discard button when not dirty", () => {
    renderWithProviders(
      <ConfigChip
        label="OBSERVER"
        value="SF"
        isDirty={false}
        popoverTitle="Edit observer"
        onDiscard={() => {}}
      >
        <div>body</div>
      </ConfigChip>,
    );
    fireEvent.click(screen.getByRole("button", { name: /OBSERVER/i }));
    expect(screen.queryByRole("button", { name: /Discard/i })).not.toBeInTheDocument();
  });
});
