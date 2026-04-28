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

  it("setPositions places mesh at latLngAltToVec3 result", () => {
    // Lock in the fix to the plan's altitude bug. With lat=0, lng=0, alt_km=0
    // and EARTH_RADIUS_UNITS=1, latLngAltToVec3 returns (1, 0, 0).
    // If anyone reverts to the plan's incorrect `* 1000 * ALT_EXAGGERATION`
    // signature, this test will fail (mesh placed at radius ~32, not ~1).
    const lm = createLiveMarkers(1.0);
    lm.setPositions([{ lat: 0, lng: 0, alt_km: 0 }]);
    const mesh = lm.group.children[0] as THREE.Mesh;
    expect(mesh.position.x).toBeCloseTo(1, 5);
    expect(mesh.position.y).toBeCloseTo(0, 5);
    expect(mesh.position.z).toBeCloseTo(0, 5);
    lm.dispose();
  });
});
