import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";

type SkyTrackSample = {
  lat: number;
  lng: number;
  altitudeM: number;
};

const DEG = Math.PI / 180;

/** Convert dense sky-track samples to a flat number[] of surface positions
 *  (tiny outward offset to avoid z-fighting with the earth mesh).
 *
 *  Uses the same convention as `latLngAltToVec3` in `@/lib/geo3d`:
 *  - +y = north pole
 *  - +x = (lat=0, lng=0)
 *  - -z = (lat=0, lng=90°E)
 *
 *  Keeping this aligned with `latLngAltToVec3` is critical — the satellite
 *  marker uses that helper. Any divergence renders the track on the opposite
 *  hemisphere from the satellite.
 */
export function samplesToSurfacePositions(
  samples: SkyTrackSample[],
  radius: number,
): number[] {
  const out: number[] = [];
  const offset = radius * 1.001;
  for (const s of samples) {
    const latR = s.lat * DEG;
    const lngR = s.lng * DEG;
    out.push(
      offset * Math.cos(latR) * Math.cos(lngR),
      offset * Math.sin(latR),
      -offset * Math.cos(latR) * Math.sin(lngR),
    );
  }
  return out;
}

export type GroundTrackHandle = {
  group: THREE.Group;
  /** Replace the track geometry (called on new pass selection). */
  setTrack: (samples: SkyTrackSample[]) => void;
  /** Truncate the progress line to [0..cursorIndex] samples. */
  setProgress: (cursorIndex: number) => void;
  /** Hide or show the entire group (no selection = hidden). */
  setVisible: (v: boolean) => void;
  dispose: () => void;
};

/** Dual-line ground track: faint gray full-arc + bright orange progress,
 *  with a translucent thicker under-line for a cheap glow. */
export function createGroundTrackMesh(
  earthRadius: number,
  rendererSize: { width: number; height: number },
): GroundTrackHandle {
  const group = new THREE.Group();

  const bgGeom = new LineGeometry();
  const bgMat = new LineMaterial({
    color: 0xc8d2e6,
    linewidth: 1.5,
    transparent: true,
    opacity: 0.3,
  });
  bgMat.resolution.set(rendererSize.width, rendererSize.height);
  const bgLine = new Line2(bgGeom, bgMat);
  group.add(bgLine);

  const progGeom = new LineGeometry();
  const progMat = new LineMaterial({
    color: 0xff9650,
    linewidth: 2.5,
    transparent: true,
    opacity: 0.95,
  });
  progMat.resolution.set(rendererSize.width, rendererSize.height);
  const progLine = new Line2(progGeom, progMat);
  group.add(progLine);

  const glowMat = new LineMaterial({
    color: 0xff9650,
    linewidth: 6,
    transparent: true,
    opacity: 0.35,
  });
  glowMat.resolution.set(rendererSize.width, rendererSize.height);
  const glowLine = new Line2(progGeom, glowMat);
  group.add(glowLine);

  group.visible = false;
  let currentSampleCount = 0;
  let allPositions: number[] = [];

  const setTrack = (samples: SkyTrackSample[]) => {
    const positions = samplesToSurfacePositions(samples, earthRadius);
    bgGeom.setPositions(positions);
    progGeom.setPositions(positions);
    allPositions = positions;
    currentSampleCount = samples.length;
    progLine.visible = true;
    glowLine.visible = true;
  };

  /** Truncate the progress line to [0..cursorIndex] samples.
   *
   *  `Line2` from three/examples renders thick lines as instanced quads, so
   *  `geometry.setDrawRange()` does NOT shorten what's drawn. The reliable
   *  way to truncate is to re-set the position attribute with a sliced array.
   *  ~200 samples × 60fps = trivial allocation cost. */
  const setProgress = (cursorIndex: number) => {
    const clamped = Math.max(0, Math.min(cursorIndex, currentSampleCount));
    if (clamped < 2 || allPositions.length === 0) {
      progLine.visible = false;
      glowLine.visible = false;
      return;
    }
    progLine.visible = true;
    glowLine.visible = true;
    const truncated = allPositions.slice(0, clamped * 3);
    progGeom.setPositions(truncated);
  };

  const setVisible = (v: boolean) => {
    group.visible = v;
  };

  const dispose = () => {
    bgGeom.dispose();
    bgMat.dispose();
    progGeom.dispose();
    progMat.dispose();
    glowMat.dispose();
  };

  return { group, setTrack, setProgress, setVisible, dispose };
}
