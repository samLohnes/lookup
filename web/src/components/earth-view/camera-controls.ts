import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type CameraControlsHandle = {
  controls: OrbitControls;
  /** Tween the camera to frame the given observer lat/lng. */
  reframeToObserver: (lat: number, lng: number) => void;
  dispose: () => void;
};

const DEG = Math.PI / 180;

/** Distance from earth center (scene units). */
const CAMERA_DISTANCE = 3.5;

/** Camera target position for a given observer location, with a small
 *  latitude offset so the observer ends up above viewport center (leaves
 *  room for the bottom dock + PiP).
 *
 *  Uses the same lat/lng → Cartesian convention as `latLngAltToVec3`
 *  (+y = north, -z = east). A mismatch reframes the camera to the
 *  mirror hemisphere of the actual observer. */
function latLngToCameraPos(lat: number, lng: number): THREE.Vector3 {
  const offsetLat = lat - 12;
  const latR = offsetLat * DEG;
  const lngR = lng * DEG;
  return new THREE.Vector3(
    CAMERA_DISTANCE * Math.cos(latR) * Math.cos(lngR),
    CAMERA_DISTANCE * Math.sin(latR),
    -CAMERA_DISTANCE * Math.cos(latR) * Math.sin(lngR),
  );
}

/** Drag-to-rotate OrbitControls (no zoom, no pan) + a programmatic
 *  reframe-to-observer tween triggered on pass selection. */
export function createCameraControls(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
): CameraControlsHandle {
  const controls = new OrbitControls(camera, domElement);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = Math.PI - 0.3;

  let tweenId: number | null = null;

  const reframeToObserver = (lat: number, lng: number) => {
    if (tweenId !== null) cancelAnimationFrame(tweenId);
    const from = camera.position.clone();
    const to = latLngToCameraPos(lat, lng);
    const start = performance.now();
    const duration = 800;

    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1.0);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      camera.position.lerpVectors(from, to, eased);
      camera.lookAt(0, 0, 0);
      if (t < 1) {
        tweenId = requestAnimationFrame(step);
      } else {
        tweenId = null;
      }
    };
    tweenId = requestAnimationFrame(step);

    // Cancel tween on user input.
    const cancel = () => {
      if (tweenId !== null) {
        cancelAnimationFrame(tweenId);
        tweenId = null;
      }
      domElement.removeEventListener("pointerdown", cancel);
    };
    domElement.addEventListener("pointerdown", cancel, { once: true });
  };

  const dispose = () => {
    if (tweenId !== null) cancelAnimationFrame(tweenId);
    controls.dispose();
  };

  return { controls, reframeToObserver, dispose };
}
