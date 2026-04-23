uniform sampler2D dayTex;
uniform sampler2D nightTex;
uniform vec3 sunDir;

varying vec3 vWorldNormal;
varying vec2 vUv;

void main() {
  float d = dot(normalize(vWorldNormal), normalize(sunDir));

  // Day side: overlay a deep ocean blue on pixels that are both dark AND
  // blue-channel-dominant.
  //
  // The "Blue Marble Next Generation" texture renders oceans as nearly
  // black; multiplying that stays black. We discriminate ocean from dark
  // land by hue: ocean keeps a subtle blue tint (B > R and B > G) even
  // when very dark, while land (tropical forests, mountains, dark soil)
  // is green or brown (G or R dominant). Combining a brightness gate with
  // a blue-bias gate preserves Central America, the Amazon, etc.
  vec3 dayRaw = texture2D(dayTex, vUv).rgb;
  float brightness = (dayRaw.r + dayRaw.g + dayRaw.b) / 3.0;
  float blueBias = dayRaw.b - max(dayRaw.r, dayRaw.g);
  float darkness = 1.0 - smoothstep(0.05, 0.13, brightness);
  float blueness = smoothstep(0.0, 0.01, blueBias);
  float oceanFactor = darkness * blueness;
  vec3 oceanBlue = vec3(0.08, 0.20, 0.42);
  vec3 day = mix(dayRaw * 1.2, oceanBlue, oceanFactor);

  // Night-side city lights — boosted to read clearly under linear tone
  // mapping. Black Marble has black oceans by design; leaves them dark.
  vec3 night = texture2D(nightTex, vUv).rgb * 1.0;

  // Terminator: sharp with a thin ramp.
  float t = smoothstep(-0.02, 0.08, d);
  vec3 color = mix(night, day, t);

  gl_FragColor = vec4(color, 1.0);
}
