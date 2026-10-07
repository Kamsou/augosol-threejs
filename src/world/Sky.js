import * as THREE from 'three'
import { FOG_COLOR, FOG_DENSITY, COLORS, SUN_DIRECTION } from '../utils/Constants.js'
import { WIND } from './Wind.js'

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

const vertexShader = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = /* glsl */ `
  uniform vec3 topColor;
  uniform vec3 midColor;
  uniform vec3 bottomColor;
  uniform vec3 sunColor;
  uniform vec3 sunDir;
  uniform float exponent;
  uniform float uTime;

  varying vec3 vDir;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < ${isMobile ? 3 : 5}; i++) {
      v += noise(p) * a;
      p = p * 2.03 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float h = max(dir.y + 0.05, 0.0);
    float t = pow(h, exponent);

    vec3 color = t < 0.4
      ? mix(bottomColor, midColor, t / 0.4)
      : mix(midColor, topColor, (t - 0.4) / 0.6);

    float sunDot = max(dot(dir, sunDir), 0.0);

    // Warm horizon bloom towards the sun
    color += sunColor * pow(sunDot, 6.0) * 0.35 * (1.0 - t);
    color += sunColor * pow(sunDot, 64.0) * 0.6;

    // Drifting cumulus projected on a virtual cloud plane
    if (dir.y > 0.0) {
      vec2 uv = dir.xz / (dir.y + 0.12) * 1.6;
      uv += vec2(uTime * 0.012, uTime * 0.006);
      float n = fbm(uv);
      float cover = smoothstep(0.48, 0.78, n);
      float edge = smoothstep(0.0, 0.25, dir.y);
      float lit = 0.75 + 0.5 * pow(sunDot, 3.0);
      vec3 cloudCol = mix(vec3(1.0, 0.88, 0.78), sunColor * 1.15, pow(sunDot, 4.0)) * lit;
      // Silver lining on cloud borders facing the sun
      float rim = smoothstep(0.48, 0.58, n) - smoothstep(0.58, 0.72, n);
      cloudCol += sunColor * rim * pow(sunDot, 2.0) * 0.8;
      color = mix(color, cloudCol, cover * edge * 0.85);
    }

    // Sun disc, bright enough to feed the bloom pass
    float disc = smoothstep(0.9993, 0.9997, sunDot);
    color += sunColor * disc * 4.0;

    gl_FragColor = vec4(color, 1.0);
    // No-ops when rendering into the composer, correct output when drawing straight to the canvas (mobile)
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export default class Sky {
  constructor(scene) {
    const geometry = new THREE.SphereGeometry(400, 48, 24)
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        topColor: { value: COLORS.sky.top.clone() },
        midColor: { value: new THREE.Color(0xe8a86b) },
        bottomColor: { value: COLORS.sky.bottom.clone() },
        sunColor: { value: new THREE.Color(0xffc98e) },
        sunDir: { value: SUN_DIRECTION.clone() },
        exponent: { value: 0.35 },
        uTime: WIND.uTime,
      },
      side: THREE.BackSide,
      depthWrite: false,
    })

    this.mesh = new THREE.Mesh(geometry, material)
    this.mesh.frustumCulled = false
    this.mesh.renderOrder = -1
    scene.add(this.mesh)

    scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY)
  }

  update(cameraPosition) {
    // Keep the dome centred on the viewer so the horizon never gets closer
    this.mesh.position.copy(cameraPosition)
  }
}
