import * as THREE from 'three'
import { PENSIONS, HORSE } from '../utils/Constants.js'

// Enter/leave radii with hysteresis so the mood never flickers on the boundary
const ENTER_RADIUS = 32
const LEAVE_RADIUS = 37
const CONTENT_STOP_DELAY = 0.8

const _toCenter = new THREE.Vector3()
const _forward = new THREE.Vector3()
const _yAxis = new THREE.Vector3(0, 1, 0)

// What the horse "says" when arriving somewhere; N = its name at the start of a sentence
const LINES = {
  good: [
    (N) => `${N} se sent bien ici`,
    (N) => `${N} se détend, il respire`,
    () => 'Un endroit où il ferait bon vivre',
  ],
  bad: [
    (N) => `${N} est mal à l'aise`,
    (N) => `${N} refuse d'avancer`,
    (N, n) => `Quelque chose inquiète ${n} ici`,
  ],
}

// The horse tells the player how a place feels before any panel does:
// body language, sound, colour grading and a reluctant gait in the bad places.
export default class PensionMood {
  constructor(experience) {
    this.experience = experience
    this.zone = null
    this.mood = 0
    this._target = 0
    this._stillTime = 0
    this._contentDone = false
    this._lineIndex = { good: 0, bad: 0 }
    this.overlay = document.getElementById('mood-overlay')
    this._lastOverlay = null
  }

  _nearest(position) {
    let best = null
    let bestDist = Infinity
    for (const [key, config] of Object.entries(PENSIONS)) {
      const d = Math.hypot(position.x - config.position.x, position.z - config.position.z)
      if (d < bestDist) {
        bestDist = d
        best = key
      }
    }
    return { key: best, dist: bestDist }
  }

  _line(kind) {
    const lines = LINES[kind]
    const line = lines[this._lineIndex[kind] % lines.length]
    this._lineIndex[kind]++
    const { profile } = this.experience
    return line(profile.Name, profile.nameInSentence)
  }

  _enter(key) {
    const { world, audio, emotes } = this.experience
    const config = PENSIONS[key]
    this.zone = key
    this._stillTime = 0
    this._contentDone = false

    if (config.ethical) {
      this._target = 1
      audio.snort()
      world.herd?.greet(key, world.horse.mesh.position)
      emotes.say('heart', this._line('good'))
    } else {
      this._target = -1
      const fast = Math.abs(world.horse.controller.speed) > HORSE.walkSpeed + 2
      if (fast) world.horse.react('balk')
      audio.snort(true)
      emotes.say('alert', this._line('bad'))
    }
  }

  _leave() {
    const { world, emotes } = this.experience
    const wasBad = this.zone && !PENSIONS[this.zone].ethical
    this.zone = null
    this._target = 0
    world.horse.controller.speedLimit = Infinity
    if (wasBad) emotes.say('calm', `${this.experience.profile.Name} retrouve son calme`, 2200)
  }

  reset() {
    this.zone = null
    this._target = 0
    this.experience.world.horse.controller.speedLimit = Infinity
  }

  update(dt) {
    const { world, renderer, audio } = this.experience
    const horse = world.horse
    const position = horse.mesh.position
    const { key, dist } = this._nearest(position)

    if (this.zone && (key !== this.zone || dist > LEAVE_RADIUS)) this._leave()
    if (!this.zone && dist < ENTER_RADIUS) this._enter(key)

    if (this.zone) {
      const config = PENSIONS[this.zone]
      if (config.ethical) {
        // Once the rider stops here, the horse visibly relaxes
        this._stillTime = Math.abs(horse.controller.speed) < 0.5 ? this._stillTime + dt : 0
        if (!this._contentDone && this._stillTime > CONTENT_STOP_DELAY && horse.react('content')) {
          this._contentDone = true
          audio.snort()
        }
      } else {
        // Drags its hooves towards the place, happily trots away from it
        _toCenter.set(config.position.x - position.x, 0, config.position.z - position.z).normalize()
        _forward.set(0, 0, -1).applyAxisAngle(_yAxis, horse.controller.currentRotation)
        horse.controller.speedLimit = _forward.dot(_toCenter) > 0.2 ? HORSE.walkSpeed : Infinity
      }
    }

    horse.earPinTarget = this._target < 0 ? 1 : 0
    this.mood += (this._target - this.mood) * Math.min(dt * 1.5, 1)
    renderer.mood = this.mood
    audio.mood = this.mood

    if (this.overlay) {
      const value = Math.round(this.mood * 100) / 100
      if (value !== this._lastOverlay) {
        this._lastOverlay = value
        this.overlay.style.setProperty('--tense', Math.max(-value, 0))
        this.overlay.style.setProperty('--warm', Math.max(value, 0))
      }
    }
  }
}
