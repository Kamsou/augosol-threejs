import * as THREE from 'three'

// Uniforms shared by every wind-driven shader (grass, trees, particles)
export const WIND = {
  uTime: { value: 0 },
  uWindDir: { value: new THREE.Vector2(0.8, 0.6).normalize() },
  uWindStrength: { value: 1.0 },
}

export function updateWind(dt) {
  WIND.uTime.value += dt
  const t = WIND.uTime.value
  // Slow gusts so the meadow breathes instead of waving mechanically
  WIND.uWindStrength.value = 0.75 + Math.sin(t * 0.21) * 0.25 + Math.sin(t * 0.57) * 0.12
}

// GLSL helpers reused by the wind shaders
export const WIND_GLSL = /* glsl */ `
  uniform float uTime;
  uniform vec2 uWindDir;
  uniform float uWindStrength;

  float windHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float windNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = windHash(i);
    float b = windHash(i + vec2(1.0, 0.0));
    float c = windHash(i + vec2(0.0, 1.0));
    float d = windHash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // Large rolling gusts travelling along the wind direction
  float windGust(vec2 worldXZ) {
    vec2 p = worldXZ * 0.045 - uWindDir * uTime * 0.55;
    return windNoise(p) * 0.65 + windNoise(p * 2.3 + 7.0) * 0.35;
  }
`
