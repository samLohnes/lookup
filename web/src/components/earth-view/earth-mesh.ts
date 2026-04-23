import * as THREE from "three";
import earthVert from "./shaders/earth-day-night.vert?raw";
import earthFrag from "./shaders/earth-day-night.frag?raw";
import { sunDirectionForDate } from "@/lib/sun-direction";

export type EarthMeshHandle = {
  mesh: THREE.Mesh;
  updateSunDirection: (date: Date) => void;
  dispose: () => void;
};

/** Blue-Marble + Black-Marble earth sphere with a fragment-shader day/night
 *  blend driven by a `sunDir` uniform. Call `updateSunDirection(date)` to
 *  shift the terminator. */
export function createEarthMesh(radius: number): Promise<EarthMeshHandle> {
  const loader = new THREE.TextureLoader();
  return Promise.all([
    loader.loadAsync("/earth-blue-marble-4k.jpg"),
    loader.loadAsync("/earth-black-marble-4k.jpg"),
  ]).then(([dayTex, nightTex]) => {
    dayTex.colorSpace = THREE.SRGBColorSpace;
    nightTex.colorSpace = THREE.SRGBColorSpace;

    const geometry = new THREE.SphereGeometry(radius, 128, 64);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        dayTex: { value: dayTex },
        nightTex: { value: nightTex },
        sunDir: { value: new THREE.Vector3(1, 0, 0) },
      },
      vertexShader: earthVert,
      fragmentShader: earthFrag,
    });
    const mesh = new THREE.Mesh(geometry, material);

    const updateSunDirection = (date: Date) => {
      const v = sunDirectionForDate(date);
      (material.uniforms.sunDir.value as THREE.Vector3).set(v.x, v.y, v.z);
    };
    updateSunDirection(new Date());

    const dispose = () => {
      geometry.dispose();
      material.dispose();
      dayTex.dispose();
      nightTex.dispose();
    };

    return { mesh, updateSunDirection, dispose };
  });
}
