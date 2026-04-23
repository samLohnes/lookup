import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScene } from "@/components/earth-view/scene-factory";

// Three.js' WebGLRenderer requires a real WebGL context. In jsdom we mock
// `getContext('webgl2')` to return a minimal object. Three's renderer will
// throw if it can't initialize — so we mock at a higher level by stubbing
// WebGLRenderer itself. We can't test rendered output here; we test that
// the factory wires the right mesh shapes.

vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  class MockWebGLRenderer {
    setSize = vi.fn();
    setPixelRatio = vi.fn();
    dispose = vi.fn();
    render = vi.fn();
    domElement = { width: 0, height: 0 } as unknown as HTMLCanvasElement;
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
  };
});

describe("createScene", () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement("canvas");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates earth, observer pin, satellite marker, and ground track meshes", () => {
    const handles = createScene({
      canvas,
      width: 320,
      height: 320,
      textureUrl: "/earth-blue-marble.jpg",
    });

    expect(handles.scene.children.length).toBeGreaterThanOrEqual(4);
    expect(handles.earthMesh.geometry.type).toBe("SphereGeometry");
    expect(handles.observerPin.geometry.type).toBe("SphereGeometry");
    expect(handles.satelliteMarker.geometry.type).toBe("SphereGeometry");
    expect(handles.groundTrack.type).toBe("Line");

    handles.dispose();
  });
});
