uniform sampler2D dayTex;
uniform sampler2D nightTex;
uniform vec3 sunDir;

varying vec3 vWorldNormal;
varying vec2 vUv;

void main() {
  float d = dot(normalize(vWorldNormal), normalize(sunDir));

  // Day side: boost lifts ocean blues + landmass tones. The Blue Marble
  // texture's mid-tones are intentionally muted; without a lift here, deep
  // oceans read as near-black even with linear tone mapping.
  vec3 day = texture2D(dayTex, vUv).rgb * 1.4;
  // Night-side city lights — kept at unit gain; boosted from the original
  // 0.6 to read clearly after the brightened day side.
  vec3 night = texture2D(nightTex, vUv).rgb * 1.0;

  // Terminator: sharp with a thin ramp.
  float t = smoothstep(-0.02, 0.08, d);
  vec3 color = mix(night, day, t);

  gl_FragColor = vec4(color, 1.0);
}
