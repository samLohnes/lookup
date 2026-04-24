// Procedural starfield: hashes the normalized fragment direction into
// three tiers of stars (fine / medium / bright) plus a subtle Milky Way
// band along a tilted plane. No texture sampling — infinite resolution
// at any viewport size.

varying vec3 vWorldPos;

float hash(vec3 p) {
  p = fract(p * vec3(443.8975, 397.2973, 491.1871));
  p += dot(p, p.yxz + 19.19);
  return fract((p.x + p.y) * p.z);
}

vec3 starColor(float rand) {
  // Warm / cool / neutral colour variation based on hash.
  if (rand > 0.97) return vec3(1.0, 0.85, 0.65);   // rare warm
  if (rand > 0.92) return vec3(0.75, 0.85, 1.0);   // rare cool
  return vec3(1.0, 0.97, 0.9);                     // common white-warm
}

void main() {
  vec3 dir = normalize(vWorldPos);

  // Tier 1 — dense fine stars (small, subtle).
  vec3 q1 = dir * 800.0;
  float h1 = hash(floor(q1));
  float star1 = smoothstep(0.997, 1.0, h1);

  // Tier 2 — medium stars.
  vec3 q2 = dir * 250.0;
  float h2 = hash(floor(q2));
  float star2 = smoothstep(0.992, 1.0, h2) * 0.8;

  // Tier 3 — rare bright stars.
  vec3 q3 = dir * 80.0;
  float h3 = hash(floor(q3));
  float star3 = smoothstep(0.985, 1.0, h3) * 1.1;

  // Milky Way band — subtle violet-white gradient along a tilted plane.
  vec3 galacticPlane = normalize(vec3(sin(0.38), 0.0, cos(0.38)));
  float bandDist = abs(dot(dir, galacticPlane));
  float band = smoothstep(0.35, 0.0, bandDist) * 0.12;
  vec3 bandColor = vec3(0.55, 0.48, 0.68);

  vec3 color = band * bandColor;
  float bright = max(star1, max(star2, star3));
  float hueSelector = h1 * 2.0;
  color += bright * starColor(hueSelector);

  gl_FragColor = vec4(color, 1.0);
}
