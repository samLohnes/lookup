import * as THREE from "three";

export type StarfieldHandle = {
  mesh: THREE.Mesh;
  dispose: () => void;
};

/** Large back-faced sphere with an equirectangular starfield texture —
 *  provides the sky backdrop behind the earth. Static; never updates. */
export function createStarfieldMesh(earthRadius: number): Promise<StarfieldHandle> {
  const loader = new THREE.TextureLoader();
  return loader.loadAsync("/star-field-4k.jpg").then((tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    const geometry = new THREE.SphereGeometry(earthRadius * 10, 32, 16);
    const material = new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.BackSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    return {
      mesh,
      dispose: () => {
        geometry.dispose();
        material.dispose();
        tex.dispose();
      },
    };
  });
}
