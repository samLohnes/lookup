import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScene } from "@/components/earth-view/scene-factory";

// Three.js' WebGLRenderer requires a real WebGL context. In jsdom we mock
// `getContext('webgl2')` to return a minimal object. Three's renderer will
// throw if it can't initialize — so we mock at a higher level by stubbing
// WebGLRenderer itself. We also stub TextureLoader since the composed mesh
// factories pull textures off the network. We can't test rendered output
// here; we test that the factory wires the right mesh shapes.

vi.mock("three", async () => {
  const actual = await vi.importActual<typeof import("three")>("three");
  class MockWebGLRenderer {
    setSize = vi.fn();
    setPixelRatio = vi.fn();
    dispose = vi.fn();
    render = vi.fn();
    domElement = { width: 0, height: 0 } as unknown as HTMLCanvasElement;
  }
  class MockTextureLoader {
    loadAsync = vi.fn(async () => new actual.Texture());
    load = vi.fn(() => new actual.Texture());
  }
  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer,
    TextureLoader: MockTextureLoader,
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

  it("composes earth, atmosphere, starfield, pin, marker, ground track", async () => {
    const handles = await createScene({ canvas, width: 320, height: 320 });

    // Earth + atmosphere + starfield + pin + marker + groundTrack group = 6 children
    expect(handles.scene.children.length).toBeGreaterThanOrEqual(6);
    expect(handles.earthMesh.geometry.type).toBe("SphereGeometry");
    expect(handles.observerPin.geometry.type).toBe("SphereGeometry");
    expect(handles.satelliteMarker.geometry.type).toBe("SphereGeometry");
    expect(handles.groundTrack.type).toBe("Group");

    expect(typeof handles.updateSunDirection).toBe("function");
    expect(typeof handles.setTrack).toBe("function");
    expect(typeof handles.setProgress).toBe("function");
    expect(typeof handles.setTrackVisible).toBe("function");
    expect(typeof handles.reframeToObserver).toBe("function");

    handles.dispose();
  });
});
