uniform sampler2D dayTex;
uniform sampler2D nightTex;
uniform vec3 sunDir;

varying vec3 vWorldNormal;
varying vec2 vUv;

void main() {
  float d = dot(normalize(vWorldNormal), normalize(sunDir));

  // Day side: overlay a deep ocean blue on dark pixels.
  //
  // The "Blue Marble Next Generation" texture renders oceans as nearly
  // black (designed for high-altitude natural-color perspective). Multiplying
  // black by any factor stays black — we have to procedurally tint dark
  // pixels to get vibrant ocean. The brightness threshold + smoothstep
  // keeps the boundary natural where coastlines meet shallow water.
  vec3 dayRaw = texture2D(dayTex, vUv).rgb;
  float brightness = (dayRaw.r + dayRaw.g + dayRaw.b) / 3.0;
  vec3 oceanBlue = vec3(0.08, 0.20, 0.42);
  float oceanFactor = 1.0 - smoothstep(0.04, 0.10, brightness);
  vec3 day = mix(dayRaw * 1.2, oceanBlue, oceanFactor);

  // Night-side city lights — boosted to read clearly under linear tone
  // mapping. Black Marble has black oceans by design; leaves them dark.
  vec3 night = texture2D(nightTex, vUv).rgb * 1.0;

  // Terminator: sharp with a thin ramp.
  float t = smoothstep(-0.02, 0.08, d);
  vec3 color = mix(night, day, t);

  gl_FragColor = vec4(color, 1.0);
}
