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
 *  (tiny outward offset to avoid z-fighting with the earth mesh). */
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
      offset * Math.cos(latR) * Math.sin(lngR),
      offset * Math.sin(latR),
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

  const setTrack = (samples: SkyTrackSample[]) => {
    const positions = samplesToSurfacePositions(samples, earthRadius);
    bgGeom.setPositions(positions);
    progGeom.setPositions(positions);
    currentSampleCount = samples.length;
  };

  const setProgress = (cursorIndex: number) => {
    const clamped = Math.max(0, Math.min(cursorIndex, currentSampleCount));
    progLine.geometry.setDrawRange(0, clamped);
    glowLine.geometry.setDrawRange(0, clamped);
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
