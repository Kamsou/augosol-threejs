import * as THREE from 'three'
import { COURSE, coursePoint } from '../utils/Constants.js'
import { createBeamMaterial } from './BeamMaterial.js'

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
const BEST_KEY = 'augosol-course-best'
const REARM_DISTANCE = 9
// Hooves must be this high when the forelegs pass over the pole...
const FRONT_CLEARANCE = 0.75
// ...and still off the ground when the hind legs follow, a body length later
const HIND_OFFSET = 3.6
// Poles are judged where the chest is, not at the centre of the horse
const CHEST_REACH = 1.8
const HIND_CLEARANCE = 0.2
// Knocked poles are put back once the rider has moved on
const RESET_DELAY = 7
const RESET_DISTANCE = 14

const _prev = new THREE.Vector2()
const _curr = new THREE.Vector2()
const _zAxis = new THREE.Vector3()
const _chest = new THREE.Vector2()

function readBest() {
  try {
    const v = parseFloat(localStorage.getItem(BEST_KEY))
    return Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

function writeBest(v) {
  try {
    localStorage.setItem(BEST_KEY, String(v))
  } catch {
    // Private mode: the record only lasts for this visit
  }
}

// Do segments p1-p2 and p3-p4 intersect? (2D, x/y)
function segmentsCross(p1, p2, p3, p4) {
  const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x)
  if (Math.abs(d) < 1e-9) return false
  const t = ((p3.x - p1.x) * (p4.y - p3.y) - (p3.y - p1.y) * (p4.x - p3.x)) / d
  const u = ((p3.x - p1.x) * (p2.y - p1.y) - (p3.y - p1.y) * (p2.x - p1.x)) / d
  return t >= 0 && t <= 1 && u >= 0 && u <= 1
}

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  draw(canvas.getContext('2d'), width, height)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

export function formatTime(seconds) {
  // Round first, otherwise 59.97 s would print as 0:60.0
  const tenths = Math.round(seconds * 10) / 10
  const m = Math.floor(tenths / 60)
  const s = tenths - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

// A ring of show jumps. Ride through the arch to start the clock, clear the jumps
// in order (each knocked pole costs seconds) and come back through the arch.
export default class JumpCourse {
  constructor(scene, terrain) {
    this.scene = scene
    this.terrain = terrain
    this.group = new THREE.Group()
    scene.add(this.group)

    this.state = 'idle'
    this.time = 0
    this.next = 0
    this.faults = 0
    this.best = readBest()
    this._armed = true
    this._listeners = []
    this._prevPos = null
    this._clock = 0

    this._materials()
    this._buildJumps()
    this._buildGate()
    this._buildMarker()
  }

  on(fn) {
    this._listeners.push(fn)
  }

  _emit(type, data = {}) {
    for (const fn of this._listeners) fn({ type, ...data })
  }

  get penalty() {
    return this.faults * COURSE.penalty
  }

  get total() {
    return this.time + this.penalty
  }

  get gatePosition() {
    return this.gate.center
  }

  get nextJumpPosition() {
    return this.state === 'running' && this.next < this.jumps.length ? this.jumps[this.next].center : null
  }

  _materials() {
    const stripes = canvasTexture(256, 16, (ctx, w, h) => {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? '#f6f1e8' : '#c4472f'
        ctx.fillRect((i * w) / 8, 0, w / 8, h)
      }
    })
    this.poleMat = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.5 })
    this.uprightMat = new THREE.MeshStandardMaterial({ color: 0xf2ece2, roughness: 0.6 })
    this.planterMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.9 })
    this.hedgeMat = new THREE.MeshStandardMaterial({ color: 0x4e7a32, roughness: 0.9 })
  }

  _surface(x, z) {
    return this.terrain.getHeightAt(x, z)
  }

  // Each jump sits on the ellipse, its poles across the riding direction
  _buildJumps() {
    this.jumps = []
    const w = COURSE.width
    for (let i = 0; i < COURSE.jumps; i++) {
      const theta = Math.PI + ((i + 1) / (COURSE.jumps + 1)) * Math.PI * 2
      const center = coursePoint(theta)
      center.y = this._surface(center.x, center.z)
      // Tangent of the ellipse for increasing theta = riding direction
      const tangent = new THREE.Vector3(-Math.sin(theta) * COURSE.radii[0], 0, Math.cos(theta) * COURSE.radii[1]).normalize()
      const across = new THREE.Vector3(-tangent.z, 0, tangent.x)

      const jump = new THREE.Group()
      jump.position.copy(center)
      jump.rotation.y = Math.atan2(across.x, across.z) - Math.PI / 2

      for (const side of [-1, 1]) {
        const upright = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.9, 0.22), this.uprightMat)
        upright.position.set(side * (w / 2), 0.95, 0)
        upright.castShadow = !isMobile
        jump.add(upright)

        const wing = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.12), this.uprightMat)
        wing.position.set(side * (w / 2 + 0.5), 0.65, 0)
        wing.castShadow = !isMobile
        jump.add(wing)

        const planter = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.35, 0.6), this.planterMat)
        planter.position.set(side * (w / 2 - 0.9), 0.18, 0.55)
        jump.add(planter)
        const hedge = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), this.hedgeMat)
        hedge.scale.set(1.2, 0.7, 0.7)
        hedge.position.set(side * (w / 2 - 0.9), 0.48, 0.55)
        jump.add(hedge)
      }

      const poleGeo = new THREE.CylinderGeometry(0.07, 0.07, w, 10)
      poleGeo.rotateZ(Math.PI / 2)
      const ground = new THREE.Mesh(poleGeo, this.poleMat)
      ground.position.set(0, 0.35, 0)
      jump.add(ground)

      // The top pole pivots on one cup so it can tip off when knocked
      const pivot = new THREE.Group()
      pivot.position.set(-w / 2, COURSE.poleHeight, 0)
      const top = new THREE.Mesh(poleGeo, this.poleMat)
      top.position.set(w / 2, 0, 0)
      top.castShadow = !isMobile
      pivot.add(top)
      jump.add(pivot)

      const number = new THREE.Mesh(
        new THREE.PlaneGeometry(0.6, 0.6),
        new THREE.MeshBasicMaterial({
          map: canvasTexture(128, 128, (ctx, cw, ch) => {
            ctx.fillStyle = '#2a1a0e'
            ctx.beginPath()
            ctx.arc(cw / 2, ch / 2, cw / 2 - 4, 0, Math.PI * 2)
            ctx.fill()
            ctx.fillStyle = '#f5e6d0'
            ctx.font = 'bold 72px sans-serif'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(String(i + 1), cw / 2, ch / 2 + 4)
          }),
          side: THREE.DoubleSide,
        })
      )
      number.position.set(w / 2 + 0.5, 1.55, 0.08)
      jump.add(number)

      this.group.add(jump)

      const half = across.clone().multiplyScalar(w / 2)
      this.jumps.push({
        center,
        tangent,
        a: new THREE.Vector2(center.x - half.x, center.z - half.z),
        b: new THREE.Vector2(center.x + half.x, center.z + half.z),
        pivot,
        group: jump,
        fall: 0,
        knocked: false,
        side: 1,
        knockedAt: 0,
        rise: 0,
        pending: null,
      })
    }
  }

  _buildGate() {
    const theta = Math.PI
    const center = coursePoint(theta)
    center.y = this._surface(center.x, center.z)
    const tangent = new THREE.Vector3(-Math.sin(theta) * COURSE.radii[0], 0, Math.cos(theta) * COURSE.radii[1]).normalize()
    const across = new THREE.Vector3(-tangent.z, 0, tangent.x)
    const w = 8

    const gate = new THREE.Group()
    gate.position.copy(center)
    gate.rotation.y = Math.atan2(across.x, across.z) - Math.PI / 2

    const postMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.8 })
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 5.2, 8), postMat)
      post.position.set(side * (w / 2), 2.6, 0)
      post.castShadow = !isMobile
      gate.add(post)
    }

    const bannerTexture = canvasTexture(1024, 160, () => {})
    const drawBanner = () => {
      const canvas = bannerTexture.image
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#2a1a0e'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#f59e0b'
      ctx.fillRect(0, canvas.height - 10, canvas.width, 10)
      ctx.fillStyle = '#f5e6d0'
      ctx.font = '700 64px Unbounded, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Départ · arrivée', canvas.width / 2, canvas.height / 2)
      bannerTexture.needsUpdate = true
    }
    drawBanner()
    document.fonts?.ready.then(drawBanner)

    const banner = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 0.4, 1.25),
      new THREE.MeshStandardMaterial({ map: bannerTexture, side: THREE.DoubleSide, roughness: 0.7 })
    )
    banner.position.set(0, 4.6, 0)
    gate.add(banner)

    const checker = canvasTexture(256, 32, (ctx, cw, ch) => {
      const size = ch / 2
      for (let x = 0; x < cw / size; x++) {
        for (let y = 0; y < 2; y++) {
          ctx.fillStyle = (x + y) % 2 ? '#1c140e' : '#f5efe6'
          ctx.fillRect(x * size, y * size, size, size)
        }
      }
    })
    const line = new THREE.Mesh(new THREE.PlaneGeometry(w, 1), new THREE.MeshStandardMaterial({ map: checker, roughness: 0.9 }))
    line.rotation.x = -Math.PI / 2
    line.position.set(0, 0.06, 0)
    line.receiveShadow = true
    gate.add(line)

    this.group.add(gate)

    const half = across.clone().multiplyScalar(w / 2)
    this.gate = {
      center,
      tangent,
      a: new THREE.Vector2(center.x - half.x, center.z - half.z),
      b: new THREE.Vector2(center.x + half.x, center.z + half.z),
    }
  }

  // Golden chevron + light shaft over the jump to take next
  _buildMarker() {
    this.marker = new THREE.Group()
    const chevron = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 0.9, 4),
      new THREE.MeshStandardMaterial({ color: 0xffc23d, emissive: 0xff9a1a, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3 })
    )
    chevron.rotation.x = Math.PI
    chevron.position.y = 3.2
    this.marker.add(chevron)
    this._chevron = chevron

    const beamGeo = new THREE.CylinderGeometry(0.05, 0.4, 10, 10, 1, true)
    beamGeo.translate(0, 5, 0)
    this.marker.add(new THREE.Mesh(beamGeo, createBeamMaterial(0xffb347, 0.2)))
    this.marker.visible = false
    this.scene.add(this.marker)
  }

  _resetPoles() {
    for (const jump of this.jumps) {
      jump.knocked = false
      jump.fall = 0
      jump.rise = 0
      jump.pending = null
      this._poseFallen(jump, 0)
    }
  }

  // 0 = on its cups, 1 = lying on the ground on the side the horse pushed it
  _poseFallen(jump, t) {
    // Tip off the first cup, hit the ground, bounce once
    const bounce = t < 0.75 ? (t / 0.75) ** 2 : 1 - Math.sin(((t - 0.75) / 0.25) * Math.PI) * 0.12
    jump.pivot.rotation.z = -bounce * 0.19
    jump.pivot.rotation.x = t * 2.4 * jump.side
    jump.pivot.position.z = bounce * 0.7 * jump.side
  }

  _knock(jump, dirX, dirZ, hind) {
    jump.knocked = true
    jump.knockedAt = this._clock
    jump.fall = 0
    jump.rise = 0
    // Fall on the side the horse was heading to
    _zAxis.set(0, 0, 1).applyQuaternion(jump.group.quaternion)
    jump.side = dirX * _zAxis.x + dirZ * _zAxis.z >= 0 ? 1 : -1
    this._resolve(jump, false, hind)
  }

  // A jump was either cleared or knocked: count it if it was the one to take
  _resolve(jump, clear, hind = false) {
    const index = this.jumps.indexOf(jump)
    const counts = this.state === 'running' && index === this.next
    if (counts) {
      if (!clear) this.faults++
      this.next++
    }
    this._emit(clear ? 'clear' : 'knock', { index: index + 1, total: this.jumps.length, counts, hind })
  }

  // Distance along the riding direction to the next standing pole straight ahead (for the jump assist)
  poleAhead(position, heading, maxDistance = 30) {
    const fx = -Math.sin(heading)
    const fz = -Math.cos(heading)
    let best = null
    for (const jump of this.jumps) {
      if (jump.knocked) continue
      // Ray (position, f) against segment a-b
      const ex = jump.b.x - jump.a.x
      const ez = jump.b.y - jump.a.y
      const denom = fx * ez - fz * ex
      if (Math.abs(denom) < 1e-6) continue
      const wx = jump.a.x - position.x
      const wz = jump.a.y - position.z
      const t = (wx * ez - wz * ex) / denom
      const u = (wx * fz - wz * fx) / denom
      if (t > 0 && t < maxDistance && u > -0.1 && u < 1.1 && (best === null || t < best)) best = t
    }
    return best
  }

  _start() {
    this.state = 'running'
    this.time = 0
    this.next = 0
    this.faults = 0
    this._resetPoles()
    this._emit('start')
  }

  _finish() {
    const total = this.total
    const record = this.best === null || total < this.best
    if (record) {
      this.best = total
      writeBest(total)
    }
    this.state = 'idle'
    this._armed = false
    this._emit('finish', { total, faults: this.faults, record, best: this.best })
  }

  abort() {
    if (this.state !== 'running') return
    this.state = 'idle'
    this._emit('abort')
  }

  update(dt, horse) {
    this._clock += dt
    const pos = horse.mesh.position
    _curr.set(pos.x, pos.z)
    if (!this._prevPos) this._prevPos = new THREE.Vector2(pos.x, pos.z)
    _prev.copy(this._prevPos)
    // A jump of several metres in one frame is a teleport (restart), not riding
    const step = _curr.distanceTo(_prev)
    const moved = step > 1e-4 && step < 6

    const dirX = _curr.x - _prev.x
    const dirZ = _curr.y - _prev.y
    const forwardThrough = (gateLike) => dirX * gateLike.tangent.x + dirZ * gateLike.tangent.z > 0

    // First time the rider comes near, invite them to try
    if (!this._discovered && this.state === 'idle'
      && Math.hypot(pos.x - this.gate.center.x, pos.z - this.gate.center.z) < 32) {
      this._discovered = true
      this._emit('discover', { best: this.best })
    }

    // Re-arm the arch once the rider has moved away from it after a finish
    if (!this._armed && Math.hypot(pos.x - this.gate.center.x, pos.z - this.gate.center.z) > REARM_DISTANCE) {
      this._armed = true
    }

    if (moved && segmentsCross(_prev, _curr, this.gate.a, this.gate.b) && forwardThrough(this.gate)) {
      if (this.state === 'idle' && this._armed) {
        this._start()
      } else if (this.state === 'running') {
        if (this.next >= this.jumps.length) this._finish()
        else this._emit('incomplete', { remaining: this.jumps.length - this.next })
      }
    }

    if (this.state === 'running') {
      this.time += dt
      if (Math.hypot(pos.x - COURSE.center.x, pos.z - COURSE.center.z) > COURSE.abortDistance) this.abort()
    }

    // Every standing pole reacts, course or not: hit it and it falls
    const stepLength = Math.hypot(dirX, dirZ)
    const heading = horse.controller.currentRotation
    _chest.set(_curr.x - Math.sin(heading) * CHEST_REACH, _curr.y - Math.cos(heading) * CHEST_REACH)
    if (!this._prevChest || !moved) this._prevChest = _chest.clone()
    for (const jump of this.jumps) {
      if (jump.pending) {
        // Forelegs went over: wait for the hind legs to pass too
        jump.pending.travelled += stepLength
        if (jump.pending.travelled >= HIND_OFFSET) {
          const pending = jump.pending
          jump.pending = null
          if (horse.controller.airborne && horse.controller.jumpHeight > HIND_CLEARANCE) this._resolve(jump, true)
          else this._knock(jump, pending.dirX, pending.dirZ, true)
        }
        continue
      }
      if (jump.knocked || !moved || !segmentsCross(this._prevChest, _chest, jump.a, jump.b)) continue
      const front = horse.controller.airborne && horse.controller.jumpHeight > FRONT_CLEARANCE
      if (front) jump.pending = { travelled: 0, dirX, dirZ }
      else this._knock(jump, dirX, dirZ, false)
    }

    // Knocked poles fall with a bounce, then are quietly put back once the rider has moved on
    for (const j of this.jumps) {
      if (!j.knocked) continue
      if (j.fall < 1) {
        j.fall = Math.min(j.fall + dt * 2, 1)
        this._poseFallen(j, j.fall)
        continue
      }
      const away = Math.hypot(pos.x - j.center.x, pos.z - j.center.z) > RESET_DISTANCE
      const waited = this._clock - j.knockedAt > RESET_DELAY
      if (this.state !== 'running' && away && waited) {
        j.rise = Math.min(j.rise + dt * 1.5, 1)
        this._poseFallen(j, 1 - j.rise)
        if (j.rise >= 1) j.knocked = false
      }
    }

    const target = this.nextJumpPosition
    this.marker.visible = !!target
    if (target) {
      this.marker.position.copy(target)
      this._chevron.position.y = 3.2 + Math.sin(performance.now() * 0.004) * 0.25
      this._chevron.rotation.y += dt * 2
    }

    this._prevPos.copy(_curr)
    this._prevChest.copy(_chest)
  }
}
