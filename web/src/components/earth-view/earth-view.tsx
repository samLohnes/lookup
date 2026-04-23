import { useEffect, useRef } from "react";
import { createScene, type SceneHandles } from "./scene-factory";
import { latLngAltToVec3 } from "@/lib/geo3d";
import { useObserverStore } from "@/store/observer";
import { useTrackAtCursor } from "@/hooks/use-track-at-cursor";

const TEXTURE_URL = "/earth-blue-marble.jpg";

/** 3D earth view rendered with Three.js. Mounts a canvas inside a div,
 *  drives a requestAnimationFrame render loop, and updates mesh positions
 *  whenever the observer location or playback cursor sample changes.
 */
export function EarthView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const handlesRef = useRef<SceneHandles | null>(null);
  const observer = useObserverStore((s) => s.current);
  const { sample } = useTrackAtCursor();

  // Mount once.
  useEffect(() => {
    if (!containerRef.current) return;

    const canvas = document.createElement("canvas");
    const rect = containerRef.current.getBoundingClientRect();
    const width = Math.floor(rect.width || 320);
    const height = Math.floor(rect.height || 320);
    containerRef.current.appendChild(canvas);

    const handles = createScene({
      canvas,
      width,
      height,
      textureUrl: TEXTURE_URL,
    });
    handlesRef.current = handles;

    // StrictMode-safe initial placement. Without this, the three reactive
    // effects below miss their first window because handlesRef is null
    // during the double-mount's brief null phase.
    const initialObs = latLngAltToVec3(observer.lat, observer.lng, 0);
    handles.observerPin.position.set(initialObs.x, initialObs.y, initialObs.z);
    const initialLen = Math.hypot(initialObs.x, initialObs.y, initialObs.z);
    const initialCameraDistance = 3;
    handles.camera.position.set(
      (initialObs.x / initialLen) * initialCameraDistance,
      (initialObs.y / initialLen) * initialCameraDistance,
      (initialObs.z / initialLen) * initialCameraDistance,
    );
    handles.camera.lookAt(0, 0, 0);

    let raf = 0;
    const renderLoop = () => {
      handles.renderer.render(handles.scene, handles.camera);
      raf = requestAnimationFrame(renderLoop);
    };
    raf = requestAnimationFrame(renderLoop);

    return () => {
      cancelAnimationFrame(raf);
      handles.dispose();
      canvas.remove();
      handlesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move the observer pin whenever the observer changes.
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;
    const v = latLngAltToVec3(observer.lat, observer.lng, 0);
    handles.observerPin.position.set(v.x, v.y, v.z);
  }, [observer.lat, observer.lng]);

  // Move the satellite marker whenever the cursor sample changes.
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;
    if (!sample) {
      handles.satelliteMarker.visible = false;
      return;
    }
    handles.satelliteMarker.visible = true;
    const v = latLngAltToVec3(sample.lat, sample.lng, sample.alt_km);
    handles.satelliteMarker.position.set(v.x, v.y, v.z);
  }, [sample]);

  // Auto-orbit camera so observer pin is roughly centered.
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;
    const v = latLngAltToVec3(observer.lat, observer.lng, 0);
    const len = Math.hypot(v.x, v.y, v.z);
    const cameraDistance = 3;
    handles.camera.position.set(
      (v.x / len) * cameraDistance,
      (v.y / len) * cameraDistance,
      (v.z / len) * cameraDistance,
    );
    handles.camera.lookAt(0, 0, 0);
  }, [observer.lat, observer.lng]);

  return (
    <div
      ref={containerRef}
      className="w-full h-[320px] rounded-card overflow-hidden border border-edge bg-bg"
      role="region"
      aria-label="3D earth view"
    />
  );
}
