import * as THREE from 'three'
import NpcHorse from '../entities/NpcHorse.js'
import { PENSIONS, HERDS, COATS } from '../utils/Constants.js'

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
const HIDE_DISTANCE = 150
const FULL_RATE_DISTANCE = 70
// Horses are long: collide as capsules (segment along the body + radius)
const HALF_LENGTH = 1.7
const BODY_RADIUS = 1.05

const _a0 = new THREE.Vector2()
const _a1 = new THREE.Vector2()
const _b0 = new THREE.Vector2()
const _b1 = new THREE.Vector2()
const _pa = new THREE.Vector2()
const _pb = new THREE.Vector2()

function axis(position, heading, out0, out1) {
  const fx = -Math.sin(heading) * HALF_LENGTH
  const fz = -Math.cos(heading) * HALF_LENGTH
  out0.set(position.x - fx, position.z - fz)
  out1.set(position.x + fx, position.z + fz)
}

// Closest points between two 2D segments (p1-q1, p2-q2), written into _pa / _pb
function closestPoints(p1, q1, p2, q2) {
  const d1x = q1.x - p1.x, d1y = q1.y - p1.y
  const d2x = q2.x - p2.x, d2y = q2.y - p2.y
  const rx = p1.x - p2.x, ry = p1.y - p2.y
  const a = d1x * d1x + d1y * d1y
  const e = d2x * d2x + d2y * d2y
  const f = d2x * rx + d2y * ry
  const c = d1x * rx + d1y * ry
  const b = d1x * d2x + d1y * d2y
  const denom = a * e - b * b
  let s = denom > 1e-6 ? THREE.MathUtils.clamp((b * f - c * e) / denom, 0, 1) : 0
  let t = (b * s + f) / e
  if (t < 0) { t = 0; s = THREE.MathUtils.clamp(-c / a, 0, 1) }
  else if (t > 1) { t = 1; s = THREE.MathUtils.clamp((b - c) / a, 0, 1) }
  _pa.set(p1.x + d1x * s, p1.y + d1y * s)
  _pb.set(p2.x + d2x * t, p2.y + d2y * t)
}

// The other horses of the domain: free and together where they are well kept,
// alone and motionless where they are not.
export default class Herd {
  constructor(scene, terrain, playerHorse) {
    this.scene = scene
    this.terrain = terrain
    this.horses = []
    this._frame = 0

    for (const [key, herd] of Object.entries(HERDS)) {
      const center = PENSIONS[key].position
      // Lighter on phones: keep one horse per pension, they still tell the story
      const members = isMobile ? herd.horses.slice(0, 1) : herd.horses
      for (const def of members) {
        const npc = new NpcHorse(playerHorse.model, playerHorse.clips, {
          coat: COATS[def.coat],
          mode: def.mode,
          earsBack: def.earsBack,
        })
        npc.pension = key
        npc.zone = herd.zone
        npc.center = center
        const heading = def.facing ?? Math.random() * Math.PI * 2
        npc.placeAt(center.x + def.at[0], center.z + def.at[1], heading, terrain)
        scene.add(npc.root)
        this.horses.push(npc)
      }
    }

    this._ctx = {
      terrain,
      player: new THREE.Vector3(),
      pickTarget: (npc, away) => this._pickTarget(npc, away),
    }
  }

  _inZone(npc, x, z) {
    const zone = npc.zone
    const lx = x - npc.center.x
    const lz = z - npc.center.z
    if (zone.rect) {
      const [x0, z0, x1, z1] = zone.rect
      if (lx < x0 || lx > x1 || lz < z0 || lz > z1) return false
    } else if (Math.hypot(lx, lz) > zone.radius) {
      return false
    }
    return !(zone.avoid || []).some(a => Math.hypot(lx - a.x, lz - a.z) < a.r)
  }

  _pickTarget(npc, awayFromPlayer) {
    const player = this._ctx.player
    for (let attempt = 0; attempt < 20; attempt++) {
      let x, z
      if (npc.zone.rect) {
        const [x0, z0, x1, z1] = npc.zone.rect
        x = npc.center.x + THREE.MathUtils.lerp(x0, x1, Math.random())
        z = npc.center.z + THREE.MathUtils.lerp(z0, z1, Math.random())
      } else {
        const a = Math.random() * Math.PI * 2
        const r = Math.sqrt(Math.random()) * npc.zone.radius
        x = npc.center.x + Math.cos(a) * r
        z = npc.center.z + Math.sin(a) * r
      }
      if (!this._inZone(npc, x, z)) continue
      if (Math.hypot(x - npc.position.x, z - npc.position.z) < 5) continue
      if (Math.hypot(x - player.x, z - player.z) < (awayFromPlayer ? 8 : 5)) continue
      // Keep some personal space between herd mates
      const crowded = this.horses.some(o => o !== npc && o.pension === npc.pension
        && (Math.hypot(x - o.position.x, z - o.position.z) < 4.5
          || (o.state === 'walk' && Math.hypot(x - o.target.x, z - o.target.z) < 4.5)))
      if (crowded) continue
      npc.target.set(x, 0, z)
      return true
    }
    return false
  }

  // When the rider arrives in a good pension, the closest horse comes over to say hello
  greet(pensionKey, playerPosition) {
    let best = null
    let bestDist = Infinity
    for (const npc of this.horses) {
      if (npc.pension !== pensionKey || npc.mode !== 'wander') continue
      const d = npc.position.distanceTo(playerPosition)
      if (d < bestDist) { bestDist = d; best = npc }
    }
    if (!best) return

    // Stop a few metres short of the rider, inside its own zone
    const dir = new THREE.Vector3().subVectors(best.position, playerPosition).setY(0).normalize()
    for (let r = 5; r <= bestDist; r += 1) {
      const x = playerPosition.x + dir.x * r
      const z = playerPosition.z + dir.z * r
      if (this._inZone(best, x, z)) {
        best.greet(new THREE.Vector3(x, 0, z))
        return
      }
    }
  }

  // Push the player out of other horses so nobody walks through anybody
  collide(playerPosition, playerHeading) {
    axis(playerPosition, playerHeading, _a0, _a1)
    const minDist = BODY_RADIUS * 2
    for (const npc of this.horses) {
      if (!npc.root.visible) continue
      if (Math.abs(npc.position.x - playerPosition.x) > 8 || Math.abs(npc.position.z - playerPosition.z) > 8) continue
      axis(npc.position, npc.heading, _b0, _b1)
      closestPoints(_a0, _a1, _b0, _b1)
      const dx = _pa.x - _pb.x
      const dz = _pa.y - _pb.y
      const dist = Math.hypot(dx, dz)
      if (dist >= minDist) continue
      const push = minDist - dist
      const nx = dist > 1e-4 ? dx / dist : 1
      const nz = dist > 1e-4 ? dz / dist : 0
      playerPosition.x += nx * push
      playerPosition.z += nz * push
      axis(playerPosition, playerHeading, _a0, _a1)
    }
  }

  update(dt, playerPosition) {
    this._frame++
    this._ctx.player.copy(playerPosition)

    for (let i = 0; i < this.horses.length; i++) {
      const npc = this.horses[i]
      const dist = Math.hypot(npc.position.x - playerPosition.x, npc.position.z - playerPosition.z)
      npc.root.visible = dist < HIDE_DISTANCE
      if (!npc.root.visible) continue
      // Nearby horses animate every frame, farther ones every third frame (staggered)
      const animate = dist < FULL_RATE_DISTANCE || (this._frame + i) % 3 === 0
      npc.update(dt, this._ctx, animate)
    }
  }
}
