import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js'

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

const CLIP = {
  idle: 'Horse|AA Horse_Idle_01_Horse',
  walk: 'Horse|AS_Horse_G0_Walk_Horse',
  trot: 'Horse|AS_Horse_G1_Trot_Horse',
}
const GRAZE_POOL = [
  'Horse|AA Horse_Idle_01_Horse',
  'Horse|AS_Horse_Idle_02_Horse',
  'Horse|AS_Horse_Idle_03_Horse',
  'Horse|AS_Horse_Idle_04_Horse',
  'Horse|AS_Horse_Idle_Fidget_03_Horse',
  'Horse|AS_Horse_Idle_Fidget_05_Horse',
]
const EAR_BONES = ['ear_01_l_032', 'ear_01_r_034']
const EAR_AXIS = new THREE.Vector3(0, 0, -1)
const _earOffset = new THREE.Quaternion().setFromAxisAngle(EAR_AXIS, 1.75)

const WALK_SPEED = 2.6
const TROT_SPEED = 7.5
const TURN_RATE = 1.8

// A horse of the world that is not the player's: same asset, its own coat and life
export default class NpcHorse {
  constructor(template, clips, { coat, mode = 'wander', earsBack = false }) {
    this.mode = mode
    this.root = new THREE.Group()
    this.model = cloneSkinned(template)
    this.root.add(this.model)

    const [body, mane] = coat
    this.model.traverse((child) => {
      if (!child.isMesh || !child.visible) return
      child.castShadow = !isMobile
      child.receiveShadow = true
      const tint = (m) => {
        if (m.name !== 'Body' && m.name !== 'Hair') return m
        const c = m.clone()
        c.color.set(m.name === 'Body' ? body : mane)
        return c
      }
      child.material = Array.isArray(child.material) ? child.material.map(tint) : tint(child.material)
    })

    this.mixer = new THREE.AnimationMixer(this.model)
    this._clips = new Map(clips.map(c => [c.name, c]))
    this._action = null
    this._actionName = null

    this._ears = earsBack ? EAR_BONES.map(n => this.model.getObjectByName(n)).filter(Boolean) : []
    this._earBase = this._ears.map(b => b.quaternion.clone())

    this.heading = 0
    this.speed = 0
    this.state = 'graze'
    this.timer = 1 + Math.random() * 4
    this.target = new THREE.Vector3()
    this._pendingDt = 0

    if (mode === 'statue') {
      // Frozen in a flattering pose, like a display piece
      this.play(CLIP.idle, { fade: 0, timeScale: 0 })
      this._action.time = 2.2
    } else if (mode === 'still') {
      // Listless: the slow idle of a horse with nothing to do
      this.play(CLIP.idle, { fade: 0, timeScale: 0.35 })
      this._action.time = Math.random() * 10
    } else {
      this.play(GRAZE_POOL[Math.floor(Math.random() * GRAZE_POOL.length)], { fade: 0 })
      this._action.time = Math.random() * 5
    }
  }

  get position() {
    return this.root.position
  }

  play(name, { fade = 0.5, timeScale = 1 } = {}) {
    if (name === this._actionName) {
      this._action.timeScale = timeScale
      return
    }
    const clip = this._clips.get(name)
    if (!clip) return
    const action = this.mixer.clipAction(clip)
    action.reset().setEffectiveWeight(1).fadeIn(fade).play()
    action.timeScale = timeScale
    this._action?.fadeOut(fade)
    this._action = action
    this._actionName = name
  }

  placeAt(x, z, heading, terrain) {
    this.root.position.set(x, terrain.getHeightAt(x, z) + 0.2, z)
    this.heading = heading
    this.root.rotation.y = heading
  }

  // ctx: { terrain, pickTarget(npc, away?), player, playerNear }
  update(dt, ctx, animate = true) {
    if (this.mode === 'wander') this._think(dt, ctx)

    // Far horses animate at a lower rate: accumulate time and catch up
    this._pendingDt += dt
    if (!animate) return
    for (let i = 0; i < this._ears.length; i++) this._ears[i].quaternion.copy(this._earBase[i])
    this.mixer.update(this._pendingDt)
    this._pendingDt = 0
    for (let i = 0; i < this._ears.length; i++) {
      this._earBase[i].copy(this._ears[i].quaternion)
      this._ears[i].quaternion.multiply(_earOffset)
    }
  }

  greet(point) {
    if (this.mode !== 'wander') return
    this.target.copy(point)
    this.state = 'walk'
    this.trotting = false
    this.greeting = true
  }

  _think(dt, ctx) {
    const pos = this.root.position
    const playerDist = Math.hypot(ctx.player.x - pos.x, ctx.player.z - pos.z)

    if (this.state === 'graze') {
      this.timer -= dt
      // Make room if the rider walks right into the grazing spot (unless it came to say hello)
      const crowded = playerDist < 5.5 && !this.greeting
      if (this.timer <= 0 || crowded) {
        if (ctx.pickTarget(this, crowded)) {
          this.state = 'walk'
          this.trotting = !crowded && Math.random() < 0.25
          this.greeting = false
        } else {
          this.timer = 2
        }
      }
    }

    if (this.state === 'walk') {
      const dx = this.target.x - pos.x
      const dz = this.target.z - pos.z
      const dist = Math.hypot(dx, dz)
      const stopAt = this.greeting ? 0.5 : 1.2
      if (dist < stopAt) {
        this.state = 'graze'
        this.speed = 0
        this.timer = 2.5 + Math.random() * 5
        this.play(GRAZE_POOL[Math.floor(Math.random() * GRAZE_POOL.length)], { fade: 0.6 })
      } else {
        // Heading convention matches the player: forward is -Z rotated by heading
        const desired = Math.atan2(-dx, -dz)
        let delta = desired - this.heading
        delta = Math.atan2(Math.sin(delta), Math.cos(delta))
        this.heading += THREE.MathUtils.clamp(delta, -TURN_RATE * dt, TURN_RATE * dt)
        // Slow down while turning sharply, ease in near the target
        const align = Math.max(0, Math.cos(delta))
        const cruise = this.trotting ? TROT_SPEED : WALK_SPEED
        const want = cruise * align * Math.min(1, dist / 2.5 + 0.3)
        this.speed += (want - this.speed) * Math.min(dt * 3, 1)

        pos.x -= Math.sin(this.heading) * this.speed * dt
        pos.z -= Math.cos(this.heading) * this.speed * dt
        this.root.rotation.y = this.heading
      }
    }

    pos.y += (ctx.terrain.getHeightAt(pos.x, pos.z) + 0.2 - pos.y) * Math.min(dt * 8, 1)

    if (this.state === 'walk') {
      if (this.speed > 5) this.play(CLIP.trot, { fade: 0.4, timeScale: THREE.MathUtils.clamp(this.speed / 12, 0.5, 1) })
      else if (this.speed > 0.15) this.play(CLIP.walk, { fade: 0.4, timeScale: THREE.MathUtils.clamp(this.speed / 8, 0.3, 1) })
    }
  }
}
