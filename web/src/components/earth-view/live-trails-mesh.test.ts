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

  it("setTrails places paired vertices at latLngAltToVec3 results (regression guard)", () => {
    // Lock in the fix to the prior altitude bug. Each polyline point now
    // produces 2 vertices (L and R) sharing the same world position;
    // perpendicular offset happens in the vertex shader, not in JS.
    const lt = createLiveTrails(1.0, { width: 1024, height: 768 });
    lt.setTrails([[
      { lat: 0, lng: 0, alt_km: 0 },
      { lat: 90, lng: 0, alt_km: 0 },
    ]]);
    const mesh = lt.group.children[0] as THREE.Mesh;
    const positions = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    expect(positions.count).toBe(4);  // 2N = 4 vertices for 2-point trail
    // Vertex 0 (L of point 0) and vertex 1 (R of point 0) share the same world position: (1, 0, 0)
    expect(positions.getX(0)).toBeCloseTo(1, 5);
    expect(positions.getY(0)).toBeCloseTo(0, 5);
    expect(positions.getZ(0)).toBeCloseTo(0, 5);
    expect(positions.getX(1)).toBeCloseTo(1, 5);
    expect(positions.getY(1)).toBeCloseTo(0, 5);
    expect(positions.getZ(1)).toBeCloseTo(0, 5);
    // Vertex 2 (L of point 1) and vertex 3 (R of point 1): (0, 1, 0) (north pole)
    expect(positions.getX(2)).toBeCloseTo(0, 5);
    expect(positions.getY(2)).toBeCloseTo(1, 5);
    expect(positions.getZ(2)).toBeCloseTo(0, 5);
    expect(positions.getX(3)).toBeCloseTo(0, 5);
    expect(positions.getY(3)).toBeCloseTo(1, 5);
    expect(positions.getZ(3)).toBeCloseTo(0, 5);
    lt.dispose();
  });

  it("setTrails writes aLineDistance attribute (paired, 1.0 at oldest, 0.0 at newest)", () => {
    const lt = createLiveTrails(1.0, { width: 1024, height: 768 });
    lt.setTrails([[
      { lat: 0, lng: 0, alt_km: 0 },     // oldest (index 0)
      { lat: 0, lng: 45, alt_km: 0 },    // middle
      { lat: 0, lng: 90, alt_km: 0 },    // newest (index n-1)
    ]]);
    const mesh = lt.group.children[0] as THREE.Mesh;
    const attr = mesh.geometry.getAttribute("aLineDistance") as THREE.BufferAttribute;
    expect(attr).toBeDefined();
    expect(attr.count).toBe(6);  // 2N = 6 for a 3-point trail
    // Vertex pairs: [0,1] = oldest, [2,3] = middle, [4,5] = newest
    expect(attr.getX(0)).toBeCloseTo(1.0, 5);
    expect(attr.getX(1)).toBeCloseTo(1.0, 5);
    expect(attr.getX(2)).toBeCloseTo(0.5, 5);
    expect(attr.getX(3)).toBeCloseTo(0.5, 5);
    expect(attr.getX(4)).toBeCloseTo(0.0, 5);
    expect(attr.getX(5)).toBeCloseTo(0.0, 5);
    lt.dispose();
  });

  it("tick(timeMs) updates the material uTime uniform (ms → seconds)", () => {
    const lt = createLiveTrails(1.0, { width: 1024, height: 768 });
    lt.setTrails([[
      { lat: 0, lng: 0, alt_km: 0 },
      { lat: 0, lng: 45, alt_km: 0 },
    ]]);
    const mesh = lt.group.children[0] as THREE.Mesh;
    const material = mesh.material as THREE.ShaderMaterial;
    expect(material.uniforms.uTime.value).toBe(0.0);
    lt.tick(2500);
    expect(material.uniforms.uTime.value).toBeCloseTo(2.5, 5);
    lt.tick(7000);
    expect(material.uniforms.uTime.value).toBeCloseTo(7.0, 5);
    lt.dispose();
  });

  it("setTrails writes aSide attribute alternating -1, +1", () => {
    const lt = createLiveTrails(1.0, { width: 1024, height: 768 });
    lt.setTrails([[
      { lat: 0, lng: 0, alt_km: 0 },
      { lat: 0, lng: 45, alt_km: 0 },
      { lat: 0, lng: 90, alt_km: 0 },
    ]]);
    const mesh = lt.group.children[0] as THREE.Mesh;
    const attr = mesh.geometry.getAttribute("aSide") as THREE.BufferAttribute;
    expect(attr.count).toBe(6);
    expect(attr.getX(0)).toBe(-1);
    expect(attr.getX(1)).toBe(1);
    expect(attr.getX(2)).toBe(-1);
    expect(attr.getX(3)).toBe(1);
    expect(attr.getX(4)).toBe(-1);
    expect(attr.getX(5)).toBe(1);
    lt.dispose();
  });

  it("setTrails writes aTangent attribute (backward-segment for stability across polls)", () => {
    // 3 points along the equator. In Cartesian (latLngAltToVec3 with alt=0):
    //   p0 = (lat=0, lng=0)  → (1, 0, 0)
    //   p1 = (lat=0, lng=45) → (~0.7071, 0, ~-0.7071)
    //   p2 = (lat=0, lng=90) → (0, 0, -1)
    //
    // Tangent rule: backward-segment for all points except the first (which
    // uses forward because there's no predecessor).
    //   - i=0:  forward,  p1 - p0
    //   - i=1:  backward, p1 - p0  (= forward at i=0; first segment)
    //   - i=2:  backward, p2 - p1  (second segment)
    //
    // This rule is stable across polls: when a new sample is appended,
    // every existing point's tangent is unchanged.
    const lt = createLiveTrails(1.0, { width: 1024, height: 768 });
    lt.setTrails([[
      { lat: 0, lng: 0, alt_km: 0 },
      { lat: 0, lng: 45, alt_km: 0 },
      { lat: 0, lng: 90, alt_km: 0 },
    ]]);
    const mesh = lt.group.children[0] as THREE.Mesh;
    const tangents = mesh.geometry.getAttribute("aTangent") as THREE.BufferAttribute;
    expect(tangents.count).toBe(6);
    // i=0 (forward, p1-p0). Both vertex 0 (L) and vertex 1 (R) share.
    expect(tangents.getX(0)).toBeCloseTo(0.7071 - 1, 4);
    expect(tangents.getY(0)).toBeCloseTo(0, 5);
    expect(tangents.getZ(0)).toBeCloseTo(-0.7071 - 0, 4);
    expect(tangents.getX(1)).toBeCloseTo(tangents.getX(0), 5);
    expect(tangents.getZ(1)).toBeCloseTo(tangents.getZ(0), 5);
    // i=1 (backward, p1-p0). Same as i=0 in this case (single first segment).
    expect(tangents.getX(2)).toBeCloseTo(0.7071 - 1, 4);
    expect(tangents.getY(2)).toBeCloseTo(0, 5);
    expect(tangents.getZ(2)).toBeCloseTo(-0.7071 - 0, 4);
    // i=2 (backward, p2-p1). New segment.
    expect(tangents.getX(4)).toBeCloseTo(0 - 0.7071, 4);
    expect(tangents.getY(4)).toBeCloseTo(0, 5);
    expect(tangents.getZ(4)).toBeCloseTo(-1 - (-0.7071), 4);
    lt.dispose();
  });

  it("aTangent of existing points is unchanged when a new sample is appended (poll stability)", () => {
    // The point of the backward-segment tangent rule: appending a new sample
    // at the head should not change the tangents of existing points. This
    // test mimics what happens at each /now-positions poll boundary.
    const lt = createLiveTrails(1.0, { width: 1024, height: 768 });

    // Trail with 2 points (initial state after seed).
    lt.setTrails([[
      { lat: 0, lng: 0, alt_km: 0 },
      { lat: 0, lng: 45, alt_km: 0 },
    ]]);
    const before = (lt.group.children[0] as THREE.Mesh).geometry.getAttribute("aTangent") as THREE.BufferAttribute;
    const beforeT0 = [before.getX(0), before.getY(0), before.getZ(0)];
    const beforeT1 = [before.getX(2), before.getY(2), before.getZ(2)];

    // Trail with 3 points (after one poll appends a new sample).
    lt.setTrails([[
      { lat: 0, lng: 0, alt_km: 0 },
      { lat: 0, lng: 45, alt_km: 0 },
      { lat: 0, lng: 90, alt_km: 0 },
    ]]);
    const after = (lt.group.children[0] as THREE.Mesh).geometry.getAttribute("aTangent") as THREE.BufferAttribute;
    const afterT0 = [after.getX(0), after.getY(0), after.getZ(0)];
    const afterT1 = [after.getX(2), after.getY(2), after.getZ(2)];

    // i=0 (oldest, forward) — unchanged: still p1-p0.
    expect(afterT0[0]).toBeCloseTo(beforeT0[0], 5);
    expect(afterT0[1]).toBeCloseTo(beforeT0[1], 5);
    expect(afterT0[2]).toBeCloseTo(beforeT0[2], 5);
    // i=1 (was head, now interior) — unchanged: backward p1-p0 in both cases.
    expect(afterT1[0]).toBeCloseTo(beforeT1[0], 5);
    expect(afterT1[1]).toBeCloseTo(beforeT1[1], 5);
    expect(afterT1[2]).toBeCloseTo(beforeT1[2], 5);

    lt.dispose();
  });

  it("setTrails writes triangle indices (6 per segment)", () => {
    const lt = createLiveTrails(1.0, { width: 1024, height: 768 });
    lt.setTrails([[
      { lat: 0, lng: 0, alt_km: 0 },
      { lat: 0, lng: 45, alt_km: 0 },
      { lat: 0, lng: 90, alt_km: 0 },
    ]]);
    const mesh = lt.group.children[0] as THREE.Mesh;
    const indices = mesh.geometry.getIndex();
    expect(indices).not.toBeNull();
    expect(indices!.count).toBe(12);  // 2 segments × 6 indices each
    // Segment 0: triangles (0,1,2) and (1,3,2)
    expect(indices!.getX(0)).toBe(0);
    expect(indices!.getX(1)).toBe(1);
    expect(indices!.getX(2)).toBe(2);
    expect(indices!.getX(3)).toBe(1);
    expect(indices!.getX(4)).toBe(3);
    expect(indices!.getX(5)).toBe(2);
    // Segment 1: triangles (2,3,4) and (3,5,4)
    expect(indices!.getX(6)).toBe(2);
    expect(indices!.getX(7)).toBe(3);
    expect(indices!.getX(8)).toBe(4);
    expect(indices!.getX(9)).toBe(3);
    expect(indices!.getX(10)).toBe(5);
    expect(indices!.getX(11)).toBe(4);
    lt.dispose();
  });

  it("setResolution updates the uResolution uniform", () => {
    const lt = createLiveTrails(1.0, { width: 1024, height: 768 });
    lt.setTrails([[
      { lat: 0, lng: 0, alt_km: 0 },
      { lat: 0, lng: 45, alt_km: 0 },
    ]]);
    const mesh = lt.group.children[0] as THREE.Mesh;
    const material = mesh.material as THREE.ShaderMaterial;
    // Initial value before any setResolution call: defaults to (1, 1).
    expect(material.uniforms.uResolution.value.x).toBe(1);
    expect(material.uniforms.uResolution.value.y).toBe(1);
    lt.setResolution(1920, 1080);
    expect(material.uniforms.uResolution.value.x).toBe(1920);
    expect(material.uniforms.uResolution.value.y).toBe(1080);
    lt.dispose();
  });
});
