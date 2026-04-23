import * as THREE from "three";
import { EARTH_RADIUS_UNITS } from "@/lib/geo3d";

export interface SceneHandles {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  earthMesh: THREE.Mesh;
  observerPin: THREE.Mesh;
  satelliteMarker: THREE.Mesh;
  groundTrack: THREE.Line;
  /** Releases all GPU resources. Call on unmount. */
  dispose: () => void;
}

interface CreateSceneArgs {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  textureUrl: string;
}

/** Create a Three.js scene + camera + renderer wired to a canvas. Pure
 *  factory — does not start a render loop and does not append to the DOM
 *  beyond the canvas the caller provides.
 *
 *  All meshes are initially at the origin; the calling code (earth-view.tsx)
 *  is responsible for moving the observer pin and satellite marker to the
 *  current observer's lat/lng and the cursor sample's lat/lng/alt.
 */
export function createScene(args: CreateSceneArgs): SceneHandles {
  const { canvas, width, height, textureUrl } = args;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05060a); // bg color

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
  camera.position.set(0, 0, 3);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(typeof window !== "undefined" ? window.devicePixelRatio : 1);

  // Earth sphere
  const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS_UNITS, 64, 32);
  const loader = new THREE.TextureLoader();
  const earthMaterial = new THREE.MeshBasicMaterial({
    map: loader.load(textureUrl),
  });
  const earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
  scene.add(earthMesh);

  // Observer pin — small amber sphere
  const pinGeo = new THREE.SphereGeometry(0.015, 16, 16);
  const pinMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
  const observerPin = new THREE.Mesh(pinGeo, pinMat);
  scene.add(observerPin);

  // Satellite marker — small blue sphere
  const satGeo = new THREE.SphereGeometry(0.018, 16, 16);
  const satMat = new THREE.MeshBasicMaterial({ color: 0x9ec5ff });
  const satelliteMarker = new THREE.Mesh(satGeo, satMat);
  scene.add(satelliteMarker);

  // Ground track placeholder line — points are set by the caller.
  const trackGeo = new THREE.BufferGeometry().setFromPoints([]);
  const trackMat = new THREE.LineBasicMaterial({ color: 0x9ec5ff });
  const groundTrack = new THREE.Line(trackGeo, trackMat);
  scene.add(groundTrack);

  function dispose() {
    earthGeometry.dispose();
    earthMaterial.dispose();
    earthMaterial.map?.dispose();
    pinGeo.dispose();
    pinMat.dispose();
    satGeo.dispose();
    satMat.dispose();
    trackGeo.dispose();
    trackMat.dispose();
    renderer.dispose();
  }

  return {
    scene,
    camera,
    renderer,
    earthMesh,
    observerPin,
    satelliteMarker,
    groundTrack,
    dispose,
  };
}
