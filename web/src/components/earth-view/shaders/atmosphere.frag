uniform vec3 glowColor;
uniform float intensity;

varying vec3 vNormal;
varying vec3 vViewDir;

void main() {
  float fres = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.0);
  gl_FragColor = vec4(glowColor * fres * intensity, 1.0);
}
