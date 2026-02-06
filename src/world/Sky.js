import * as THREE from 'three'
import { FOG_COLOR, FOG_DENSITY, COLORS } from '../utils/Constants.js'

const vertexShader = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform vec3 topColor;
  uniform vec3 midColor;
  uniform vec3 bottomColor;
  uniform float offset;
  uniform float exponent;

  varying vec3 vWorldPosition;

  void main() {
    float h = normalize(vWorldPosition + offset).y;
    float t = max(pow(max(h, 0.0), exponent), 0.0);

    // Two-step gradient: bottom->mid->top
    vec3 color;
    if (t < 0.4) {
      color = mix(bottomColor, midColor, t / 0.4);
    } else {
      color = mix(midColor, topColor, (t - 0.4) / 0.6);
    }

    gl_FragColor = vec4(color, 1.0);
  }
`

export default class Sky {
  constructor(scene) {
    const geometry = new THREE.SphereGeometry(400, 32, 15)
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        topColor: { value: COLORS.sky.top.clone() },
        midColor: { value: new THREE.Color(0xe8a86b) },
        bottomColor: { value: COLORS.sky.bottom.clone() },
        offset: { value: 20.0 },
        exponent: { value: 0.35 },
      },
      side: THREE.BackSide,
      depthWrite: false,
    })

    this.mesh = new THREE.Mesh(geometry, material)
    scene.add(this.mesh)

    // Warm atmospheric fog matching the Augosol palette
    scene.fog = new THREE.FogExp2(FOG_COLOR, FOG_DENSITY)
  }
}
