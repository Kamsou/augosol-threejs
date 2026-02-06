import * as THREE from 'three'
import { HORSE, WORLD_SIZE } from '../utils/Constants.js'

const _forward = new THREE.Vector3()
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

    horse.mesh.rotation.order = 'YXZ'
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
    if (this.input.isPressed('forward')) {
      targetSpeed = this.input.isPressed('gallop')
        ? HORSE.gallopSpeed
        : HORSE.trotSpeed
    }
    if (this.input.isPressed('backward')) {
      targetSpeed = -HORSE.walkSpeed * HORSE.backwardFactor
    }

    const rate = (targetSpeed > this.speed ? HORSE.acceleration : HORSE.deceleration) * dt
    this.speed = THREE.MathUtils.lerp(this.speed, targetSpeed, Math.min(rate, 1))

    if (Math.abs(this.speed) < 0.5 && targetSpeed === 0) {
      this.speed = 0
    }
    if (this.speed < 0 && targetSpeed >= 0) {
      this.speed = 0
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

    _forward.set(0, 0, -1).applyAxisAngle(_yAxis, this.currentRotation)
    const cx = mesh.position.x
    const cz = mesh.position.z
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
    mesh.position.y = this._smoothY

    const slopeDelta = hFront - hBack
    const targetPitch = Math.atan2(slopeDelta, 2.4)
    this._smoothPitch = THREE.MathUtils.lerp(this._smoothPitch, targetPitch, 4 * dt)

    mesh.rotation.y = this.currentRotation
    mesh.rotation.x = this._smoothPitch

    const analogTurn = this.input.analog?.x || 0
    const turning = analogTurn !== 0
      ? -analogTurn
      : (this.input.isPressed('left') ? 1 : 0) - (this.input.isPressed('right') ? 1 : 0)
    const targetLean = turning * 0.08 * (this.speed / HORSE.gallopSpeed)
    this._smoothLean = THREE.MathUtils.lerp(this._smoothLean, targetLean, 5 * dt)
    mesh.rotation.z = this._smoothLean
  }
}
