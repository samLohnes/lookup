uniform sampler2D dayTex;
// Night texture + sunDir uniforms remain wired (the JS still passes them)
// but the shader currently ignores them — earth renders as fully lit
// daytime. To restore the day/night blend, see the commit history before
// this change for the original mix logic. Keeping the uniforms makes
// re-enabling a one-line edit instead of rewiring the JS side.
uniform sampler2D nightTex;
uniform vec3 sunDir;

varying vec3 vWorldNormal;
varying vec2 vUv;

void main() {
  vec3 day = texture2D(dayTex, vUv).rgb;
  gl_FragColor = vec4(day, 1.0);
}
