import { useEffect, useRef } from "react";
import { createScene, type SceneHandles } from "./scene-factory";
import { latLngAltToVec3 } from "@/lib/geo3d";
import { useObserverStore } from "@/store/observer";
import { useTrackAtCursor } from "@/hooks/use-track-at-cursor";
import { useCurrentSkyTrack } from "@/hooks/use-current-sky-track";
import { useSelectionStore } from "@/store/selection";
import { usePlaybackStore } from "@/store/playback";
import { useLivePolling } from "@/hooks/use-live-polling";
import { useLivePositionStore } from "@/store/live-position";
import { extrapolatePosition } from "@/lib/live-extrapolation";
import { useCameraTargetStore } from "@/store/camera-target";

/** Find the largest index `i` such that `samples[i].time <= cursorIso`.
 *  Returns 0 when the cursor precedes the first sample. `TrackSampleResponse`
 *  times are ISO-8601 so a simple string compare (or Date.parse) works. */
/** Fractional sample index at the playback cursor.
 *
 *  Returns N.frac where N is the largest index whose time ≤ cursor and frac
 *  is the fractional progress to sample N+1. Feeding this to `setProgress`
 *  lets the progress line's tip track the satellite marker smoothly instead
 *  of snapping between sample boundaries (which looks ~1-2 sample-widths
 *  behind the marker during fast playback). */
function cursorIndexFor(
  samples: { time: string }[],
  cursorIso: string | null,
): number {
  if (!cursorIso || samples.length === 0) return 0;
  const cursor = Date.parse(cursorIso);
  if (Number.isNaN(cursor)) return 0;
  for (let i = 0; i < samples.length - 1; i += 1) {
    const t1 = Date.parse(samples[i + 1].time);
    if (cursor <= t1) {
      const t0 = Date.parse(samples[i].time);
      if (cursor <= t0) return i;
      return i + (cursor - t0) / (t1 - t0);
    }
  }
  return samples.length - 1;
}

/** 3D earth view rendered with Three.js. Mounts a canvas that fills its
 *  parent, drives a requestAnimationFrame render loop, and keeps the scene
 *  in sync with observer location, pass selection, and playback cursor. */
export function EarthView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const handlesRef = useRef<SceneHandles | null>(null);
  const observer = useObserverStore((s) => s.current);
  const { sample } = useTrackAtCursor();
  const skyTrack = useCurrentSkyTrack();
  const selectedPassId = useSelectionStore((s) => s.selectedPassId);
  const cursorUtc = usePlaybackStore((s) => s.cursorUtc);
  const cameraTarget = useCameraTargetStore((s) => s.target);

  useLivePolling();

  // Mount once.
  useEffect(() => {
    if (!containerRef.current) return;

    const canvas = document.createElement("canvas");
    const rect = containerRef.current.getBoundingClientRect();
    const width = Math.floor(rect.width || 320);
    const height = Math.floor(rect.height || 320);
    containerRef.current.appendChild(canvas);

    let cancelled = false;
    let raf = 0;
    let localHandles: SceneHandles | null = null;

    const handleResize = () => {
      const h = handlesRef.current;
      if (!h || !containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      const w = Math.max(1, Math.floor(r.width));
      const ht = Math.max(1, Math.floor(r.height));
      h.renderer.setSize(w, ht);
      h.camera.aspect = w / ht;
      h.camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    createScene({ canvas, width, height }).then((handles) => {
      if (cancelled) {
        handles.dispose();
        return;
      }
      localHandles = handles;
      handlesRef.current = handles;

      // StrictMode-safe initial placement. Without this, the reactive effects
      // below miss their first window because handlesRef is null during the
      // double-mount's brief null phase.
      const initialObs = latLngAltToVec3(observer.lat, observer.lng, 0);
      handles.observerPin.position.set(
        initialObs.x,
        initialObs.y,
        initialObs.z,
      );
      const initialLen = Math.hypot(initialObs.x, initialObs.y, initialObs.z);
      const initialCameraDistance = 3;
      handles.camera.position.set(
        (initialObs.x / initialLen) * initialCameraDistance,
        (initialObs.y / initialLen) * initialCameraDistance,
        (initialObs.z / initialLen) * initialCameraDistance,
      );
      handles.camera.lookAt(0, 0, 0);

      // Ensure renderer matches any size change that happened during the
      // async texture load.
      handleResize();

      const renderLoop = () => {
        // Live-mode wiring: read store directly to avoid React render churn
        // at 60fps. When live mode is active, drive the live meshes from
        // extrapolated positions; otherwise keep them hidden.
        const live = useLivePositionStore.getState();
        const liveModeActive =
          live.activeNorads.length > 0 && live.lastPolledAt !== null;

        if (liveModeActive) {
          // Pass-mode meshes hidden while live mode owns the globe.
          handles.satelliteMarker.visible = false;
          handles.groundTrack.visible = false;

          const now = performance.now();
          const interpolated = live.activeNorads
            .map((nid) => {
              const latest = live.positions.get(nid);
              if (!latest) return null;
              const previous = live.previousPositions.get(nid);
              return extrapolatePosition(
                latest,
                previous,
                now,
                live.lastPolledAt!,
              );
            })
            .filter((p): p is NonNullable<typeof p> => p !== null);

          handles.liveMarkers.setPositions(interpolated);
          handles.liveMarkers.setVisible(true);

          const trails = live.activeNorads.map((nid) => {
            const trail = live.trails.get(nid) ?? [];
            return trail.map((s) => ({
              lat: s.lat,
              lng: s.lng,
              alt_km: s.alt_km,
            }));
          });
          handles.liveTrails.setTrails(trails);
          handles.liveTrails.tick(now);
          handles.liveTrails.setVisible(true);
        } else {
          handles.liveMarkers.setVisible(false);
          handles.liveTrails.setVisible(false);
        }

        handles.renderer.render(handles.scene, handles.camera);
        raf = requestAnimationFrame(renderLoop);
      };
      raf = requestAnimationFrame(renderLoop);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", handleResize);
      if (localHandles) {
        localHandles.dispose();
      }
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

  // Reframe the camera when the observer changes. The tween respects
  // OrbitControls and cancels on user drag.
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;
    handles.reframeToObserver(observer.lat, observer.lng);
  }, [observer.lat, observer.lng]);

  // Reframe the camera when the user picks a different pass.
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;
    if (selectedPassId === null) return;
    handles.reframeToObserver(observer.lat, observer.lng);
    // Observer lat/lng intentionally excluded — observer changes are handled
    // by the effect above, and including them here would cause a double
    // reframe on simultaneous observer+selection changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPassId]);

  // Reframe the camera when the LocateButton fires. Nonce-keyed so repeat
  // clicks fire even when lat/lng haven't moved.
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles || !cameraTarget) return;
    handles.reframeToObserver(cameraTarget.lat, cameraTarget.lng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraTarget?.nonce]);

  // Push the ground-track geometry to the scene when sky-track data arrives.
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;
    const samples = skyTrack.data?.samples;
    if (!samples || samples.length === 0) {
      handles.setTrackVisible(false);
      return;
    }
    const mapped = samples.map((s) => ({
      lat: s.lat,
      lng: s.lng,
      altitudeM: s.alt_km * 1000,
    }));
    handles.setTrack(mapped);
    handles.setTrackVisible(true);
  }, [skyTrack.data]);

  // Advance the progress line as playback moves the cursor.
  useEffect(() => {
    const handles = handlesRef.current;
    if (!handles) return;
    const samples = skyTrack.data?.samples;
    if (!samples || samples.length === 0) {
      handles.setProgress(0);
      return;
    }
    handles.setProgress(cursorIndexFor(samples, cursorUtc));
  }, [cursorUtc, skyTrack.data]);

  // (Day/night terminator currently disabled — earth renders fully lit. The
  // sun-direction uniform is still wired through to the shader in case we
  // re-enable the blend later, but there's no live update here.)

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-hidden bg-transparent"
      role="region"
      aria-label="3D earth view"
    />
  );
}
