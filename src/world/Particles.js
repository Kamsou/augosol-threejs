import * as THREE from 'three'
import { WIND } from './Wind.js'

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

export default class Particles {
  constructor(scene) {
    this.scene = scene
    this._time = 0

    this._createAmbientParticles()
    this._createFallingLeaves()
  }

  // Glowing pollen & fireflies drifting in the wind, wrapped around the player
  _createAmbientParticles() {
    const count = isMobile ? 220 : 700
    const box = 110
    const offsets = new Float32Array(count * 3)
    const seeds = new Float32Array(count * 2)
    const colors = new Float32Array(count * 3)

    const particleColors = [
      new THREE.Color(0xffe5c4),
      new THREE.Color(0xffc561),
      new THREE.Color(0xfbbf4d),
      new THREE.Color(0xfff2c8),
    ]

    for (let i = 0; i < count; i++) {
      offsets[i * 3] = (Math.random() - 0.5) * box
      offsets[i * 3 + 1] = Math.pow(Math.random(), 1.8) * 12 + 0.4
      offsets[i * 3 + 2] = (Math.random() - 0.5) * box
      seeds[i * 2] = Math.random() * 100
      seeds[i * 2 + 1] = 0.5 + Math.random()

      const color = particleColors[Math.floor(Math.random() * particleColors.length)]
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(offsets, 3))
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 2))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: WIND.uTime,
        uWindDir: WIND.uWindDir,
        uCenter: { value: new THREE.Vector3() },
        uBox: { value: box },
        uPixelRatio: { value: 1 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform vec2 uWindDir;
        uniform vec3 uCenter;
        uniform float uBox;
        uniform float uPixelRatio;
        attribute vec2 aSeed;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          float s = aSeed.x;
          vec3 p = position;
          p.xz += uWindDir * uTime * 0.9 * aSeed.y;
          p += vec3(sin(uTime * 0.35 + s) * 2.0, sin(uTime * 0.6 + s * 3.0) * 0.7, cos(uTime * 0.28 + s * 1.7) * 2.0);

          vec2 rel = mod(p.xz - uCenter.xz + uBox * 0.5, uBox) - uBox * 0.5;
          vec3 world = vec3(uCenter.x + rel.x, uCenter.y + p.y, uCenter.z + rel.y);

          vec4 mv = viewMatrix * vec4(world, 1.0);
          gl_Position = projectionMatrix * mv;

          float twinkle = 0.55 + 0.45 * sin(uTime * (1.5 + aSeed.y * 2.5) + s * 6.0);
          float edge = 1.0 - smoothstep(uBox * 0.3, uBox * 0.5, length(rel));
          float nearFade = smoothstep(1.5, 5.0, -mv.z);
          vAlpha = twinkle * edge * nearFade;
          vColor = color;

          gl_PointSize = (0.18 + aSeed.y * 0.16) * 260.0 * uPixelRatio / -mv.z;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float core = smoothstep(0.35, 0.0, d);
          float halo = pow(max(1.0 - d, 0.0), 2.5) * 0.45;
          float a = (core + halo) * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor * (1.0 + core * 1.5), a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    this.particles = new THREE.Points(geometry, material)
    this.particles.frustumCulled = false
    this.scene.add(this.particles)
  }

  _createFallingLeaves() {
    const leafCount = isMobile ? 12 : 40
    const leafGeo = new THREE.PlaneGeometry(0.25, 0.35)
    const leafMat = new THREE.MeshBasicMaterial({
      color: 0x9a7b3a,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
    })

    this._leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, leafCount)
    this._leafMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)

    this._leafData = []
    const dummy = new THREE.Matrix4()

    for (let i = 0; i < leafCount; i++) {
      const data = {
        x: (Math.random() - 0.5) * 200,
        y: 5 + Math.random() * 20,
        z: (Math.random() - 0.5) * 200,
        rx: Math.random() * Math.PI,
        ry: Math.random() * Math.PI,
        rz: Math.random() * Math.PI,
        speed: 0.3 + Math.random() * 0.5,
        drift: (Math.random() - 0.5) * 0.5,
        rotSpeed: (Math.random() - 0.5) * 2,
      }
      this._leafData.push(data)

      const color = new THREE.Color()
      color.setHSL(0.08 + Math.random() * 0.1, 0.4 + Math.random() * 0.3, 0.3 + Math.random() * 0.2)
      this._leafMesh.setColorAt(i, color)
    }

    if (this._leafMesh.instanceColor) this._leafMesh.instanceColor.needsUpdate = true
    this.scene.add(this._leafMesh)
    this._leafDummy = new THREE.Matrix4()
    this._leafEuler = new THREE.Euler()
  }

  update(dt, center, pixelRatio = 1) {
    this._time += dt
    // Follows the renderer (capped on mobile, lowered by dynamic resolution)
    this.particles.material.uniforms.uPixelRatio.value = pixelRatio

    if (center) this.particles.material.uniforms.uCenter.value.copy(center)

    const dummy = this._leafDummy
    const euler = this._leafEuler
    for (let i = 0; i < this._leafData.length; i++) {
      const d = this._leafData[i]
      d.y -= d.speed * dt
      d.x += d.drift * dt
      d.rx += d.rotSpeed * dt
      d.rz += d.rotSpeed * 0.5 * dt

      // Recycle leaves around the rider so they keep falling where we look
      const cy = center ? center.y : 0
      const far = center && (Math.abs(d.x - center.x) > 50 || Math.abs(d.z - center.z) > 50)
      if (d.y < cy - 1 || far) {
        d.y = cy + 10 + Math.random() * 10
        d.x = (center ? center.x : 0) + (Math.random() - 0.5) * 80
        d.z = (center ? center.z : 0) + (Math.random() - 0.5) * 80
      }

      euler.set(d.rx, d.ry, d.rz)
      dummy.makeRotationFromEuler(euler)
      dummy.setPosition(d.x, d.y, d.z)
      this._leafMesh.setMatrixAt(i, dummy)
    }
    this._leafMesh.instanceMatrix.needsUpdate = true
  }
}
