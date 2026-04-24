import * as THREE from "three";
import { EARTH_RADIUS_UNITS } from "@/lib/geo3d";
import { createEarthMesh } from "./earth-mesh";
import { createAtmosphereMesh } from "./atmosphere-mesh";
import { createStarfieldMesh } from "./starfield-mesh";
import { createGroundTrackMesh } from "./ground-track-mesh";
import { createCameraControls } from "./camera-controls";

export interface SceneHandles {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** Earth sphere mesh — day/night shader material. */
  earthMesh: THREE.Mesh;
  /** Small blue sphere marking the observer's surface location. */
  observerPin: THREE.Mesh;
  /** Small orange sphere tracing the satellite along the pass. */
  satelliteMarker: THREE.Mesh;
  /** Group containing background + progress ground-track lines. */
  groundTrack: THREE.Group;
  /** Update the earth's day/night shader to the given UTC date. */
  updateSunDirection: (date: Date) => void;
  /** Replace the ground-track geometry for a new pass. */
  setTrack: (
    samples: Array<{ lat: number; lng: number; altitudeM: number }>,
  ) => void;
  /** Truncate the progress line to the current playback cursor sample. */
  setProgress: (cursorIndex: number) => void;
  /** Show or hide the ground-track group. Selection change = toggle. */
  setTrackVisible: (v: boolean) => void;
  /** Tween the camera to frame an observer at (lat, lng). */
  reframeToObserver: (lat: number, lng: number) => void;
  /** Releases all GPU resources. Call on unmount. */
  dispose: () => void;
}

interface CreateSceneArgs {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

/** Async factory — awaits texture loads (earth day + night, starfield)
 *  before returning handles. Callers should show a loader until the promise
 *  resolves. Composes the earth, atmosphere, starfield, ground-track, and
 *  camera-controls submodules into a single scene.
 */
export async function createScene(
  args: CreateSceneArgs,
): Promise<SceneHandles> {
  const { canvas, width, height } = args;

  const scene = new THREE.Scene();
  // No solid background — starfield mesh provides the sky backdrop.

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
  camera.position.set(0, 0, 3.5);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(
    typeof window !== "undefined" ? window.devicePixelRatio : 1,
  );
  // Lift overall scene brightness slightly. Linear tone mapping is a
  // uniform multiplier (no S-curve), which preserves the texture's
  // vibrant ocean + land tones without crushing shadow values.
  renderer.toneMapping = THREE.LinearToneMapping;
  renderer.toneMappingExposure = 1.1;

  const earth = await createEarthMesh(EARTH_RADIUS_UNITS);
  const starfield = createStarfieldMesh(EARTH_RADIUS_UNITS);
  const atmosphere = createAtmosphereMesh(EARTH_RADIUS_UNITS);

  scene.add(starfield.mesh); // furthest back
  scene.add(earth.mesh);
  scene.add(atmosphere.mesh);

  // Observer pin — small blue sphere at surface.
  const pinGeo = new THREE.SphereGeometry(0.015, 16, 16);
  const pinMat = new THREE.MeshBasicMaterial({ color: 0x4a9eff });
  const observerPin = new THREE.Mesh(pinGeo, pinMat);
  scene.add(observerPin);

  // Satellite marker — small orange sphere.
  const satGeo = new THREE.SphereGeometry(0.018, 16, 16);
  const satMat = new THREE.MeshBasicMaterial({ color: 0xffae60 });
  const satelliteMarker = new THREE.Mesh(satGeo, satMat);
  satelliteMarker.visible = false;
  scene.add(satelliteMarker);

  // Ground track.
  const groundTrack = createGroundTrackMesh(EARTH_RADIUS_UNITS, {
    width,
    height,
  });
  scene.add(groundTrack.group);

  // Camera controls (drag-to-rotate + reframe tween).
  const cameraCtl = createCameraControls(camera, canvas);

  function dispose() {
    earth.dispose();
    atmosphere.dispose();
    starfield.dispose();
    groundTrack.dispose();
    cameraCtl.dispose();
    pinGeo.dispose();
    pinMat.dispose();
    satGeo.dispose();
    satMat.dispose();
    renderer.dispose();
  }

  return {
    scene,
    camera,
    renderer,
    earthMesh: earth.mesh,
    observerPin,
    satelliteMarker,
    groundTrack: groundTrack.group,
    updateSunDirection: earth.updateSunDirection,
    setTrack: groundTrack.setTrack,
    setProgress: groundTrack.setProgress,
    setTrackVisible: groundTrack.setVisible,
    reframeToObserver: cameraCtl.reframeToObserver,
    dispose,
  };
}
