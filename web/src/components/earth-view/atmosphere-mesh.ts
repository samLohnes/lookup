import * as THREE from "three";
import atmoVert from "./shaders/atmosphere.vert?raw";
import atmoFrag from "./shaders/atmosphere.frag?raw";

export type AtmosphereMeshHandle = {
  mesh: THREE.Mesh;
  dispose: () => void;
};

/** Subtle blue rim glow around the earth, rendered as a slightly-larger
 *  back-faced sphere with additive blending and Fresnel-based alpha. */
export function createAtmosphereMesh(earthRadius: number): AtmosphereMeshHandle {
  const geometry = new THREE.SphereGeometry(earthRadius * 1.03, 64, 32);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: new THREE.Color(0x7ab0e0) },
      intensity: { value: 0.6 },
    },
    vertexShader: atmoVert,
    fragmentShader: atmoFrag,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
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
