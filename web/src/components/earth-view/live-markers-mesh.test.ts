import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createLiveMarkers } from "./live-markers-mesh";

describe("createLiveMarkers", () => {
  it("starts with an empty group and visible=false", () => {
    const lm = createLiveMarkers(1.0);
    expect(lm.group).toBeInstanceOf(THREE.Group);
    expect(lm.group.children.length).toBe(0);
    expect(lm.group.visible).toBe(false);
    lm.dispose();
  });

  it("setPositions creates one mesh per position", () => {
    const lm = createLiveMarkers(1.0);
    lm.setPositions([
      { lat: 0, lng: 0, alt_km: 400 },
      { lat: 10, lng: 20, alt_km: 400 },
      { lat: 20, lng: 40, alt_km: 400 },
    ]);
    expect(lm.group.children.length).toBe(3);
    lm.dispose();
  });

  it("setPositions shrinks the pool when given fewer positions", () => {
    const lm = createLiveMarkers(1.0);
    lm.setPositions([
      { lat: 0, lng: 0, alt_km: 400 },
      { lat: 10, lng: 20, alt_km: 400 },
      { lat: 20, lng: 40, alt_km: 400 },
    ]);
    expect(lm.group.children.length).toBe(3);
    lm.setPositions([{ lat: 0, lng: 0, alt_km: 400 }]);
    expect(lm.group.children.length).toBe(1);
    lm.dispose();
  });

  it("setVisible toggles group visibility", () => {
    const lm = createLiveMarkers(1.0);
    lm.setVisible(true);
    expect(lm.group.visible).toBe(true);
    lm.setVisible(false);
    expect(lm.group.visible).toBe(false);
    lm.dispose();
  });
});
