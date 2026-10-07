import * as THREE from 'three'
import { WIND } from './Wind.js'

// Soft additive light shaft that fades towards the top and scrolls gently.
// `material.opacity` keeps working so existing pulse animations still drive it.
export function createBeamMaterial(color, opacity = 0.2) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTime: WIND.uTime,
      uOpacity: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFacing;
      void main() {
        vUv = uv;
        vec3 n = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vFacing = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      varying vec2 vUv;
      varying float vFacing;
      void main() {
        float fade = pow(1.0 - vUv.y, 1.6);
        float bands = 0.75 + 0.25 * sin(vUv.y * 28.0 - uTime * 2.5);
        float core = pow(vFacing, 1.5);
        float a = uOpacity * fade * bands * core * 3.0;
        gl_FragColor = vec4(uColor * 1.4, a);
      }
    `,
  })
  material.opacity = opacity
  material.uniforms.uOpacity = { get value() { return material.opacity } }
  return material
}
