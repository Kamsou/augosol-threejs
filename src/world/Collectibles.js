import * as THREE from 'three'
import { PENSIONS, COLLECTIBLES, WORLD_SIZE, COURSE } from '../utils/Constants.js'
import { createBeamMaterial } from './BeamMaterial.js'

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
const SPARK_POOL = isMobile ? 120 : 320
const SPARKS_PER_BURST = isMobile ? 30 : 60
const MAGNET_RADIUS = 7

const _toHorse = new THREE.Vector3()

function createGlowTexture() {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255, 236, 190, 1)')
  g.addColorStop(0.25, 'rgba(255, 196, 90, 0.55)')
  g.addColorStop(1, 'rgba(255, 160, 40, 0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

function createHorseshoeGeometry() {
  const arc = Math.PI * 1.45
  const geo = new THREE.TorusGeometry(0.72, 0.2, 10, 32, arc)
  geo.rotateZ(Math.PI / 2 - arc / 2)
  geo.scale(1, 1.1, 0.55)
  return geo
}

export default class Collectibles {
  constructor(scene, terrain, pathSystem) {
    this.scene = scene
    this.terrain = terrain
    this.pathSystem = pathSystem
    this.items = []
    this.collected = 0
    this.total = 0
    this._time = 0
    this._listeners = []

    this._geometry = createHorseshoeGeometry()
    this._material = new THREE.MeshStandardMaterial({
      color: 0xffc23d,
      metalness: 1.0,
      roughness: 0.22,
      emissive: 0xff9a1a,
      emissiveIntensity: 0.45,
    })
    this._glowMaterial = new THREE.SpriteMaterial({
      map: createGlowTexture(),
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.7,
    })
    this._beamGeometry = new THREE.CylinderGeometry(0.08, 0.55, 16, 10, 1, true)
    this._beamGeometry.translate(0, 8, 0)

    for (const pos of this._pickPositions()) this._spawn(pos)
    this.total = this.items.length

    this._createSparks()
    this._createShockwaves()
  }

  on(fn) {
    this._listeners.push(fn)
  }

  _pickPositions() {
    const positions = []
    const farEnough = (x, z) => positions.every(p => (p.x - x) ** 2 + (p.z - z) ** 2 > COLLECTIBLES.minSpacing ** 2)
    const clearOfPensions = (x, z) => Object.values(PENSIONS).every(p => (p.position.x - x) ** 2 + (p.position.z - z) ** 2 > 24 ** 2)
      && Math.hypot(x - COURSE.center.x, z - COURSE.center.z) > COURSE.clearRadius

    // A few along the paths to teach the mechanic, the rest hidden across the hills
    const trails = this.pathSystem?.trails || []
    for (const key of ['nature', 'wellness', 'intensive', 'showpiece']) {
      const trail = trails.find(t => t.key === key)
      if (!trail) continue
      const { x, z } = trail.points[Math.floor(trail.points.length * 0.55)]
      if (farEnough(x, z)) positions.push({ x, z })
    }

    const limit = WORLD_SIZE * 0.42
    for (let attempt = 0; attempt < 4000 && positions.length < COLLECTIBLES.count; attempt++) {
      const angle = Math.random() * Math.PI * 2
      const radius = 28 + Math.sqrt(Math.random()) * 180
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      if (Math.abs(x) > limit || Math.abs(z) > limit) continue
      if (!clearOfPensions(x, z) || !farEnough(x, z)) continue
      positions.push({ x, z })
    }
    return positions
  }

  _spawn({ x, z }) {
    const group = new THREE.Group()
    const baseY = this.terrain.getHeightAt(x, z) + COLLECTIBLES.hoverHeight
    group.position.set(x, baseY, z)

    const shoe = new THREE.Mesh(this._geometry, this._material)
    shoe.castShadow = !isMobile
    group.add(shoe)

    const glow = new THREE.Sprite(this._glowMaterial.clone())
    glow.scale.setScalar(3.6)
    group.add(glow)

    const beamMat = createBeamMaterial(0xffb347, 0.22)
    const beam = new THREE.Mesh(this._beamGeometry, beamMat)
    beam.position.y = -COLLECTIBLES.hoverHeight
    group.add(beam)

    this.scene.add(group)
    this.items.push({
      group, shoe, glow, beam, beamMat,
      baseY,
      phase: Math.random() * Math.PI * 2,
      state: 'idle',
      t: 0,
    })
  }

  _createSparks() {
    const positions = new Float32Array(SPARK_POOL * 3)
    const sizes = new Float32Array(SPARK_POOL)
    const alphas = new Float32Array(SPARK_POOL)
    const colors = new Float32Array(SPARK_POOL * 3)
    this._sparks = []
    for (let i = 0; i < SPARK_POOL; i++) {
      this._sparks.push({ alive: false, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0, size: 0 })
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    geometry.setAttribute('alpha', new THREE.BufferAttribute(alphas, 1))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const material = new THREE.ShaderMaterial({
      vertexShader: /* glsl */ `
        attribute float size;
        attribute float alpha;
        attribute vec3 color;
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          vAlpha = alpha;
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * (260.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = (smoothstep(1.0, 0.0, d) * 0.6 + smoothstep(0.3, 0.0, d)) * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vColor * 2.0, a);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    this._sparkPoints = new THREE.Points(geometry, material)
    this._sparkPoints.frustumCulled = false
    this.scene.add(this._sparkPoints)
    this._nextSpark = 0
  }

  _createShockwaves() {
    const geo = new THREE.RingGeometry(0.85, 1, 48)
    geo.rotateX(-Math.PI / 2)
    this._waves = []
    for (let i = 0; i < 3; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffc865,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      this.scene.add(mesh)
      this._waves.push({ mesh, t: 1 })
    }
    this._nextWave = 0
  }

  _burst(position) {
    const posArr = this._sparkPoints.geometry.attributes.position.array
    const colArr = this._sparkPoints.geometry.attributes.color.array
    const palette = [[1, 0.85, 0.45], [1, 0.95, 0.8], [1, 0.7, 0.25]]

    for (let j = 0; j < SPARKS_PER_BURST; j++) {
      const i = this._nextSpark
      this._nextSpark = (this._nextSpark + 1) % SPARK_POOL
      const s = this._sparks[i]
      s.alive = true
      s.life = 0
      s.maxLife = 0.7 + Math.random() * 0.8
      s.size = 0.4 + Math.random() * 0.6

      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const speed = 3 + Math.random() * 7
      s.vx = Math.sin(phi) * Math.cos(theta) * speed
      s.vy = Math.abs(Math.cos(phi)) * speed * 0.9 + 2
      s.vz = Math.sin(phi) * Math.sin(theta) * speed

      posArr[i * 3] = position.x
      posArr[i * 3 + 1] = position.y
      posArr[i * 3 + 2] = position.z
      const c = palette[j % palette.length]
      colArr[i * 3] = c[0]
      colArr[i * 3 + 1] = c[1]
      colArr[i * 3 + 2] = c[2]
    }
    this._sparkPoints.geometry.attributes.color.needsUpdate = true

    const wave = this._waves[this._nextWave]
    this._nextWave = (this._nextWave + 1) % this._waves.length
    wave.t = 0
    wave.mesh.visible = true
    wave.mesh.position.set(position.x, this.terrain.getHeightAt(position.x, position.z) + 0.25, position.z)
  }

  _collect(item) {
    item.state = 'collecting'
    item.t = 0
    this._remaining = null
    this.collected++
    this._burst(item.group.position)
    for (const fn of this._listeners) fn({ collected: this.collected, total: this.total, position: item.group.position.clone() })
  }

  // Cached: the HUD asks for it every frame
  getRemaining() {
    if (!this._remaining) this._remaining = this.items.filter(i => i.state === 'idle').map(i => i.group.position)
    return this._remaining
  }

  update(dt, horsePosition) {
    this._time += dt
    const r2 = COLLECTIBLES.pickupRadius ** 2

    for (const item of this.items) {
      if (item.state === 'done') continue
      const g = item.group

      if (item.state === 'idle') {
        item.shoe.rotation.y += dt * 1.6
        g.position.y = item.baseY + Math.sin(this._time * 2 + item.phase) * 0.25
        item.glow.material.opacity = 0.55 + Math.sin(this._time * 3 + item.phase) * 0.15

        _toHorse.set(horsePosition.x - g.position.x, horsePosition.y + 2.5 - g.position.y, horsePosition.z - g.position.z)
        const dist2 = _toHorse.x * _toHorse.x + _toHorse.z * _toHorse.z

        // Gentle magnet so near-misses still feel rewarding
        if (dist2 < MAGNET_RADIUS * MAGNET_RADIUS) {
          const pull = 1 - Math.sqrt(dist2) / MAGNET_RADIUS
          g.position.addScaledVector(_toHorse, Math.min(pull * 6 * dt, 1))
          item.baseY += (horsePosition.y + 2.5 - item.baseY) * Math.min(pull * 6 * dt, 1)
          item.beam.visible = false
        }

        if (dist2 < r2) this._collect(item)
      } else if (item.state === 'collecting') {
        item.t += dt / 0.55
        const t = Math.min(item.t, 1)
        const s = 1 + Math.sin(t * Math.PI) * 0.8
        item.shoe.scale.setScalar(s * (1 - t * t))
        item.shoe.rotation.y += dt * 18
        g.position.y += dt * 4
        item.glow.material.opacity = 0.9 * (1 - t)
        item.glow.scale.setScalar(3.6 + t * 6)
        item.beamMat.opacity = 0.22 * (1 - t)
        if (t >= 1) {
          item.state = 'done'
          this.scene.remove(g)
        }
      }
    }

    this._updateSparks(dt)

    for (const wave of this._waves) {
      if (wave.t >= 1) continue
      wave.t = Math.min(wave.t + dt / 0.8, 1)
      const e = 1 - Math.pow(1 - wave.t, 3)
      wave.mesh.scale.setScalar(1 + e * 9)
      wave.mesh.material.opacity = 0.6 * (1 - wave.t)
      if (wave.t >= 1) wave.mesh.visible = false
    }
  }

  _updateSparks(dt) {
    const attrs = this._sparkPoints.geometry.attributes
    const posArr = attrs.position.array
    const sizeArr = attrs.size.array
    const alphaArr = attrs.alpha.array
    let active = 0

    for (let i = 0; i < SPARK_POOL; i++) {
      const s = this._sparks[i]
      if (!s.alive) continue
      s.life += dt
      const t = s.life / s.maxLife
      if (t >= 1) {
        s.alive = false
        sizeArr[i] = 0
        alphaArr[i] = 0
        continue
      }
      active++
      s.vy -= 9 * dt
      const drag = 1 - 1.8 * dt
      s.vx *= drag
      s.vz *= drag
      posArr[i * 3] += s.vx * dt
      posArr[i * 3 + 1] += s.vy * dt
      posArr[i * 3 + 2] += s.vz * dt
      sizeArr[i] = s.size * (1 - t * 0.6)
      alphaArr[i] = (1 - t) * (0.7 + 0.3 * Math.sin(s.life * 40 + i))
    }

    if (active > 0 || this._prevSparks > 0) {
      attrs.position.needsUpdate = true
      attrs.size.needsUpdate = true
      attrs.alpha.needsUpdate = true
    }
    this._prevSparks = active
  }
}
