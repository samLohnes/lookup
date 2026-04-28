import { beforeEach, describe, expect, it } from "vitest";
import { useCameraTargetStore } from "./camera-target";

describe("useCameraTargetStore", () => {
  beforeEach(() => {
    useCameraTargetStore.getState().clear();
  });

  it("initial state has null target", () => {
    expect(useCameraTargetStore.getState().target).toBeNull();
  });

  it("reframeTo sets the target", () => {
    useCameraTargetStore.getState().reframeTo(40, -74);
    const t = useCameraTargetStore.getState().target;
    expect(t?.lat).toBe(40);
    expect(t?.lng).toBe(-74);
    expect(t?.nonce).toBeGreaterThan(0);
  });

  it("repeat reframeTo with same coords increments nonce", () => {
    useCameraTargetStore.getState().reframeTo(40, -74);
    const n1 = useCameraTargetStore.getState().target?.nonce;
    useCameraTargetStore.getState().reframeTo(40, -74);
    const n2 = useCameraTargetStore.getState().target?.nonce;
    expect(n2).toBeGreaterThan(n1!);
  });

  it("clear resets to null", () => {
    useCameraTargetStore.getState().reframeTo(40, -74);
    useCameraTargetStore.getState().clear();
    expect(useCameraTargetStore.getState().target).toBeNull();
  });
});
