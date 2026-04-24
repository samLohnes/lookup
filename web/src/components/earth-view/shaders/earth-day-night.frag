uniform sampler2D dayTex;
uniform sampler2D nightTex;
uniform vec3 sunDir;

varying vec3 vWorldNormal;
varying vec2 vUv;

void main() {
  float d = dot(normalize(vWorldNormal), normalize(sunDir));

  // Day side: read the texture straight. Source has vibrant ocean blue
  // and properly-colored landmasses, so no procedural tinting needed.
  vec3 day = texture2D(dayTex, vUv).rgb;

  // Night-side city lights — Black Marble has black oceans by design;
  // unit gain reads clearly under linear tone mapping.
  vec3 night = texture2D(nightTex, vUv).rgb;

  // Terminator: sharp with a thin ramp.
  float t = smoothstep(-0.02, 0.08, d);
  vec3 color = mix(night, day, t);

  gl_FragColor = vec4(color, 1.0);
}
