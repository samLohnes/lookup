import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { createLiveTrails } from "./live-trails-mesh";

describe("createLiveTrails", () => {
  it("starts with an empty group and visible=false", () => {
    const lt = createLiveTrails(1.0, { width: 1024, height: 768 });
    expect(lt.group).toBeInstanceOf(THREE.Group);
    expect(lt.group.children.length).toBe(0);
    expect(lt.group.visible).toBe(false);
    lt.dispose();
  });

  it("setTrails creates one polyline per non-empty trail", () => {
    const lt = createLiveTrails(1.0, { width: 1024, height: 768 });
    lt.setTrails([
      [
        { lat: 0, lng: 0, alt_km: 400 },
        { lat: 10, lng: 20, alt_km: 400 },
      ],
      [
        { lat: 20, lng: 0, alt_km: 400 },
        { lat: 30, lng: 20, alt_km: 400 },
        { lat: 40, lng: 40, alt_km: 400 },
      ],
    ]);
    expect(lt.group.children.length).toBe(2);
    lt.dispose();
  });

  it("setTrails skips trails with fewer than 2 samples (can't draw a line)", () => {
    const lt = createLiveTrails(1.0, { width: 1024, height: 768 });
    lt.setTrails([
      [{ lat: 0, lng: 0, alt_km: 400 }], // only 1 sample → skipped
      [
        { lat: 0, lng: 0, alt_km: 400 },
        { lat: 10, lng: 20, alt_km: 400 },
      ],
    ]);
    expect(lt.group.children.length).toBe(1);
    lt.dispose();
  });

  it("setTrails shrinks the pool when given fewer trails", () => {
    const lt = createLiveTrails(1.0, { width: 1024, height: 768 });
    lt.setTrails([
      [{ lat: 0, lng: 0, alt_km: 400 }, { lat: 10, lng: 20, alt_km: 400 }],
      [{ lat: 20, lng: 0, alt_km: 400 }, { lat: 30, lng: 20, alt_km: 400 }],
    ]);
    expect(lt.group.children.length).toBe(2);
    lt.setTrails([
      [{ lat: 0, lng: 0, alt_km: 400 }, { lat: 10, lng: 20, alt_km: 400 }],
    ]);
    expect(lt.group.children.length).toBe(1);
    lt.dispose();
  });

  it("setVisible toggles group visibility", () => {
    const lt = createLiveTrails(1.0, { width: 1024, height: 768 });
    lt.setVisible(true);
    expect(lt.group.visible).toBe(true);
    lt.setVisible(false);
    expect(lt.group.visible).toBe(false);
    lt.dispose();
  });

  it("setTrails places vertices at latLngAltToVec3 results (regression guard)", () => {
    // Lock in the fix to the plan's altitude bug. With lat=0, lng=0, alt_km=0
    // EARTH_RADIUS_UNITS=1, latLngAltToVec3 returns (1, 0, 0).
    // If anyone reverts to the plan's broken signature, this test fails.
    const lt = createLiveTrails(1.0, { width: 1024, height: 768 });
    lt.setTrails([[
      { lat: 0, lng: 0, alt_km: 0 },
      { lat: 90, lng: 0, alt_km: 0 },
    ]]);
    const line = lt.group.children[0] as THREE.Line;
    const positions = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    // First vertex (lat=0, lng=0, alt=0) → (1, 0, 0)
    expect(positions.getX(0)).toBeCloseTo(1, 5);
    expect(positions.getY(0)).toBeCloseTo(0, 5);
    expect(positions.getZ(0)).toBeCloseTo(0, 5);
    // Second vertex (lat=90, lng=0, alt=0) → (0, 1, 0) (north pole)
    expect(positions.getX(1)).toBeCloseTo(0, 5);
    expect(positions.getY(1)).toBeCloseTo(1, 5);
    expect(positions.getZ(1)).toBeCloseTo(0, 5);
    lt.dispose();
  });
});
