uniform sampler2D dayTex;
uniform sampler2D nightTex;
uniform vec3 sunDir;

varying vec3 vWorldNormal;
varying vec2 vUv;

void main() {
  float d = dot(normalize(vWorldNormal), normalize(sunDir));

  vec3 day = texture2D(dayTex, vUv).rgb;
  // Night-side city lights — boosted to keep them legible after the
  // renderer's tone mapping pulls overall brightness up.
  vec3 night = texture2D(nightTex, vUv).rgb * 1.0;

  // Terminator: sharp with a thin ramp.
  float t = smoothstep(-0.02, 0.08, d);
  vec3 color = mix(night, day, t);

  gl_FragColor = vec4(color, 1.0);
}
