import * as THREE from 'three'

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
const POOL_SIZE = isMobile ? 15 : 40
const EMIT_INTERVAL = isMobile ? 0.12 : 0.06

export default class DustSystem {
  constructor(scene) {
    this.scene = scene

    const positions = new Float32Array(POOL_SIZE * 3)
    const sizes = new Float32Array(POOL_SIZE)
    const alphas = new Float32Array(POOL_SIZE)

    this._particles = []
    for (let i = 0; i < POOL_SIZE; i++) {
      this._particles.push({ alive: false, life: 0, maxLife: 0, vx: 0, vy: 0, vz: 0 })
      sizes[i] = 0
      alphas[i] = 0
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))

    const material = new THREE.ShaderMaterial({
      uniforms: {
        color: { value: new THREE.Color(0xc4a87a) },
      },
      vertexShader: `
        attribute float size;
        attribute float alpha;
        varying float vAlpha;
        void main() {
          vAlpha = alpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (200.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          if (d > 1.0) discard;
          float a = vAlpha * (1.0 - d * d);
          gl_FragColor = vec4(color, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    })

    this._points = new THREE.Points(geometry, material)
    this._points.frustumCulled = false
    this.scene.add(this._points)

    this._posArr = this._points.geometry.attributes.position.array
    this._sizeArr = this._points.geometry.attributes.size.array
    this._alphaArr = this._points.geometry.attributes.alpha.array
    this._activeCount = 0
    this._emitTimer = 0
    this._nextIdx = 0
  }

  update(dt, horsePosition, speed) {
    const absSpeed = Math.abs(speed)

    if (absSpeed > 6) {
      this._emitTimer += dt
      const interval = absSpeed > 20 ? EMIT_INTERVAL * 0.5 : EMIT_INTERVAL
      while (this._emitTimer >= interval) {
        this._emitTimer -= interval
        this._emit(horsePosition, absSpeed)
      }
    } else {
      this._emitTimer = 0
    }

    const posArr = this._posArr
    const sizeArr = this._sizeArr
    const alphaArr = this._alphaArr

    let active = 0
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = this._particles[i]
      if (!p.alive) continue

      p.life += dt
      const t = p.life / p.maxLife
      if (t >= 1) {
        p.alive = false
        sizeArr[i] = 0
        alphaArr[i] = 0
        continue
      }

      active++
      posArr[i * 3] += p.vx * dt
      posArr[i * 3 + 1] += p.vy * dt
      posArr[i * 3 + 2] += p.vz * dt
      p.vy -= 1.5 * dt

      sizeArr[i] = p.startSize * (1 + t * 2)
      alphaArr[i] = p.startAlpha * (1 - t)
    }

    this._activeCount = active
    if (active > 0 || this._prevActive > 0) {
      this._points.geometry.attributes.position.needsUpdate = true
      this._points.geometry.attributes.size.needsUpdate = true
      this._points.geometry.attributes.alpha.needsUpdate = true
    }
    this._prevActive = active
  }

  _emit(pos, speed) {
    const count = speed > 20 ? 3 : 2
    for (let j = 0; j < count; j++) {
      const i = this._nextIdx
      this._nextIdx = (this._nextIdx + 1) % POOL_SIZE

      const p = this._particles[i]
      p.alive = true
      p.life = 0
      p.maxLife = 0.5 + Math.random() * 0.4
      p.startSize = 1.5 + Math.random() * 1.5
      p.startAlpha = 0.15 + Math.random() * 0.1

      const posArr = this._posArr
      posArr[i * 3] = pos.x + (Math.random() - 0.5) * 1.2
      posArr[i * 3 + 1] = pos.y + 0.1
      posArr[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 1.2

      const spread = 1.5 + speed * 0.05
      p.vx = (Math.random() - 0.5) * spread
      p.vy = 0.8 + Math.random() * 1.2
      p.vz = (Math.random() - 0.5) * spread
    }
  }
}
