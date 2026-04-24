import * as THREE from "three";
import starVert from "./shaders/starfield.vert?raw";
import starFrag from "./shaders/starfield.frag?raw";

export type StarfieldHandle = {
  mesh: THREE.Mesh;
  dispose: () => void;
};

/** Procedural starfield on a back-faced sphere.
 *
 *  Uses a fragment shader that hashes the world-space direction into
 *  three tiers of stars plus a subtle Milky Way band. No texture — the
 *  result is resolution-independent (no pixelation at any viewport size)
 *  and the sphere geometry is only responsible for feeding the fragment
 *  shader a direction vector per visible pixel.
 *
 *  Synchronous: there's no async texture load to await. */
export function createStarfieldMesh(earthRadius: number): StarfieldHandle {
  const geometry = new THREE.SphereGeometry(earthRadius * 10, 64, 32);
  const material = new THREE.ShaderMaterial({
    vertexShader: starVert,
    fragmentShader: starFrag,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return {
    mesh,
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  };
}
