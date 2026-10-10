import * as THREE from 'three'
import { HORSE, WORLD_SIZE, JUMP } from '../utils/Constants.js'

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
const _forward = new THREE.Vector3()
// Body tilt per unit of vertical speed during a jump; small, the jump clip already arches the back
const JUMP_TILT = 0.009
// After touching down, speed eases back to the gait instead of braking hard
const LANDING_EASE = 0.6

// Stick push (0.2–1) to speed: walk, then trot, then a snap to full gallop near the rim
function throttleToSpeed(t) {
  if (t >= 0.88) return HORSE.gallopSpeed
  if (t < 0.55) return THREE.MathUtils.mapLinear(t, 0.2, 0.55, HORSE.walkSpeed * 0.6, HORSE.walkSpeed)
  return THREE.MathUtils.mapLinear(t, 0.55, 0.88, HORSE.trotSpeed, HORSE.trotSpeed + 6)
}
const _yAxis = new THREE.Vector3(0, 1, 0)

export default class HorseController {
  constructor(horse, inputManager, terrain) {
    this.horse = horse
    this.input = inputManager
    this.terrain = terrain

    this.speed = 0
    this.currentRotation = 0
    this.frozen = false
    this._direction = new THREE.Vector3()
    this._smoothY = 0
    this._smoothPitch = 0
    this._smoothLean = 0
    this._yInitialized = false

    this.airborne = false
    this.onLand = null
    // Set by the pension mood: a horse that refuses to go further only walks
    this.speedLimit = Infinity
    this._jumpY = 0
    this._jumpVel = 0
    this._landingEase = 0

    horse.mesh.rotation.order = 'YXZ'
  }

  get jumpHeight() {
    return this._jumpY
  }

  // Vertical take-off speed for the current gait
  get jumpVelocity() {
    const ratio = THREE.MathUtils.clamp(Math.abs(this.speed) / HORSE.gallopSpeed, 0, 1)
    return THREE.MathUtils.lerp(JUMP.minVelocity, JUMP.maxVelocity, ratio)
  }

  // Seconds in the air for a jump started now
  get airTime() {
    return (2 * this.jumpVelocity) / JUMP.gravity
  }

  jump() {
    if (this.frozen || this.airborne) return false
    this.airborne = true
    this._jumpVel = this.jumpVelocity
    return true
  }

  _updateJump(dt) {
    if (!this.airborne) return
    this._jumpVel -= JUMP.gravity * dt
    this._jumpY += this._jumpVel * dt
    if (this._jumpY <= 0) {
      const impact = Math.abs(this._jumpVel)
      this._jumpY = 0
      this._jumpVel = 0
      this.airborne = false
      this._landingEase = LANDING_EASE
      this.onLand?.(impact)
    }
  }

  get movementState() {
    const absSpeed = Math.abs(this.speed)
    if (absSpeed < 0.5) return 'idle'
    if (absSpeed < HORSE.walkSpeed + 1) return 'walk'
    if (absSpeed < HORSE.trotSpeed + 1) return 'trot'
    return 'gallop'
  }

  update(dt) {
    if (this.frozen) return

    let targetSpeed = 0
    const analog = this.input.analog
    if (analog?.active) {
      // Touch stick: the push distance picks the gait continuously
      if (analog.throttle > 0) targetSpeed = throttleToSpeed(analog.throttle)
      else if (analog.throttle < -0.45) targetSpeed = -HORSE.walkSpeed * HORSE.backwardFactor
    } else {
      if (this.input.isPressed('forward')) {
        targetSpeed = this.input.isPressed('gallop')
          ? HORSE.gallopSpeed
          : HORSE.trotSpeed
      }
      if (this.input.isPressed('backward')) {
        targetSpeed = -HORSE.walkSpeed * HORSE.backwardFactor
      }
    }
    targetSpeed = Math.min(targetSpeed, this.speedLimit)

    // No traction mid-air: the leap keeps its momentum until the hooves touch down
    if (!this.airborne) {
      let rate = (targetSpeed > this.speed ? HORSE.acceleration : HORSE.deceleration) * dt
      if (this._landingEase > 0) {
        this._landingEase -= dt
        if (targetSpeed < this.speed) rate *= 0.25
      }
      this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, Math.min(rate, 1))

      if (Math.abs(this.speed) < 0.5 && targetSpeed === 0) {
        this.speed = 0
      }
      if (this.speed < 0 && targetSpeed >= 0) {
        this.speed = 0
      }
    }

    const turnMultiplier = 1.0 + (1.0 - Math.abs(this.speed) / HORSE.gallopSpeed) * 0.5

    const rawAnalogX = this.input.analog?.x || 0
    const analogX = Math.sign(rawAnalogX) * rawAnalogX * rawAnalogX
    if (analogX !== 0) {
      this.currentRotation -= HORSE.turnSpeed * turnMultiplier * analogX * 0.7 * dt
    } else {
      if (this.input.isPressed('left')) {
        this.currentRotation += HORSE.turnSpeed * turnMultiplier * dt
      }
      if (this.input.isPressed('right')) {
        this.currentRotation -= HORSE.turnSpeed * turnMultiplier * dt
      }
    }

    this._direction.set(0, 0, -1)
    this._direction.applyAxisAngle(_yAxis, this.currentRotation)
    this._direction.multiplyScalar(this.speed * dt)

    const mesh = this.horse.mesh
    mesh.position.add(this._direction)

    const limit = WORLD_SIZE * 0.45
    mesh.position.x = THREE.MathUtils.clamp(mesh.position.x, -limit, limit)
    mesh.position.z = THREE.MathUtils.clamp(mesh.position.z, -limit, limit)

    const cx = mesh.position.x
    const cz = mesh.position.z

    if (isMobile) {
      const groundY = this.terrain.getHeightAt(cx, cz) + 0.2

      if (!this._yInitialized) {
        this._smoothY = groundY
        this._yInitialized = true
      }

      this._smoothY = THREE.MathUtils.lerp(this._smoothY, groundY, 8 * dt)
      this._updateJump(dt)
      mesh.position.y = this._smoothY + this._jumpY

      // Same smoothed take-off / landing tilt as desktop (no terrain pitch on phones)
      this._smoothPitch = THREE.MathUtils.lerp(this._smoothPitch, this._jumpVel * JUMP_TILT, 6 * dt)
      mesh.rotation.y = this.currentRotation
      mesh.rotation.x = this._smoothPitch
    } else {
      _forward.set(0, 0, -1).applyAxisAngle(_yAxis, this.currentRotation)
      const fx = cx + _forward.x * 1.2
      const fz = cz + _forward.z * 1.2
      const bx = cx - _forward.x * 1.2
      const bz = cz - _forward.z * 1.2

      const hCenter = this.terrain.getHeightAt(cx, cz)
      const hFront = this.terrain.getHeightAt(fx, fz)
      const hBack = this.terrain.getHeightAt(bx, bz)

      const groundY = Math.max(hCenter, hFront, hBack) + 0.2

      if (!this._yInitialized) {
        this._smoothY = groundY
        this._yInitialized = true
      }

      this._smoothY = THREE.MathUtils.lerp(this._smoothY, groundY, 8 * dt)
      this._updateJump(dt)
      mesh.position.y = this._smoothY + this._jumpY

      const slopeDelta = hFront - hBack
      // Nose up on take-off, down on the way back to the ground
      const targetPitch = Math.atan2(slopeDelta, 2.4) + this._jumpVel * JUMP_TILT
      this._smoothPitch = THREE.MathUtils.lerp(this._smoothPitch, targetPitch, 6 * dt)

      mesh.rotation.y = this.currentRotation
      mesh.rotation.x = this._smoothPitch
    }

    const analogTurn = this.input.analog?.x || 0
    const turning = analogTurn !== 0
      ? -analogTurn
      : (this.input.isPressed('left') ? 1 : 0) - (this.input.isPressed('right') ? 1 : 0)
    const targetLean = turning * 0.08 * (this.speed / HORSE.gallopSpeed)
    this._smoothLean = THREE.MathUtils.lerp(this._smoothLean, targetLean, 5 * dt)
    mesh.rotation.z = this._smoothLean
  }
}
