import * as THREE from 'three'
import { CAMERA } from '../utils/Constants.js'

const _yAxis = new THREE.Vector3(0, 1, 0)
const _yawQuat = new THREE.Quaternion()
const _tmpVec = new THREE.Vector3()

export default class Camera {
  constructor(experience) {
    this.experience = experience
    this.sizes = experience.sizes

    this.instance = new THREE.PerspectiveCamera(
      CAMERA.fov,
      this.sizes.width / this.sizes.height,
      CAMERA.near,
      CAMERA.far
    )
    this.instance.position.set(0, 10, 20)
    this.instance.lookAt(0, 0, 0)

    this.target = null
    this.offset = CAMERA.offset.clone()
    this.targetOffset = CAMERA.offset.clone()
    this.lookAtOffset = CAMERA.lookAtOffset.clone()
    this.targetLookAtOffset = CAMERA.lookAtOffset.clone()
    this.lerpSpeed = CAMERA.lerpSpeed
    this.currentLookAt = new THREE.Vector3()
    this._smoothQuaternion = new THREE.Quaternion()
    this._initialized = false
    this._cinematic = null

    this._shakeTime = 0
    this._smoothFov = CAMERA.fov
    this._smoothShakeIntensity = 0

    this.sizes.on('resize', () => this.resize())
  }

  setTarget(object) {
    this.target = object
    _yawQuat.setFromAxisAngle(_yAxis, this.target.rotation.y)
    this._smoothQuaternion.copy(_yawQuat)
    _tmpVec.copy(this.offset).applyQuaternion(_yawQuat).add(this.target.position)
    this.instance.position.copy(_tmpVec)
    this.currentLookAt.copy(this.target.position).add(this.lookAtOffset)
    this._initialized = true
  }

  setApproachMode(active) {
    if (this._cinematic) return
    this.targetOffset.copy(active ? CAMERA.approachOffset : CAMERA.offset)
    this.targetLookAtOffset.copy(CAMERA.lookAtOffset)
  }

  playCinematic(callback) {
    const startAngle = Math.atan2(this.offset.x, this.offset.z)
    const startRadius = Math.sqrt(this.offset.x ** 2 + this.offset.z ** 2)
    const startY = this.offset.y

    const endAngle = startAngle + Math.PI * 0.83
    const endRadius = 12
    const endY = 6.0

    this._cinematic = {
      startTime: performance.now(),
      duration: 2000,
      startAngle, startRadius, startY,
      endAngle, endRadius, endY,
      startLookAt: this.lookAtOffset.clone(),
      endLookAt: new THREE.Vector3(0, 1.5, -1.0),
      callback
    }
  }

  stopCinematic() {
    this._cinematic = null
    this.targetOffset.copy(CAMERA.offset)
    this.targetLookAtOffset.copy(CAMERA.lookAtOffset)
  }

  get isCinematicActive() {
    return !!this._cinematic
  }

  setSpeedRatio(ratio) {
    this._targetSpeedRatio = Math.min(ratio, 1)
  }

  resize() {
    this.instance.aspect = this.sizes.width / this.sizes.height
    this.instance.updateProjectionMatrix()
  }

  update(dt) {
    if (!this.target || !this._initialized) return

    const speedRatio = this._targetSpeedRatio || 0
    this._smoothShakeIntensity = THREE.MathUtils.lerp(this._smoothShakeIntensity, speedRatio, 3 * dt)

    const targetFov = CAMERA.fov + this._smoothShakeIntensity * 7
    this._smoothFov = THREE.MathUtils.lerp(this._smoothFov, targetFov, 3 * dt)
    if (Math.abs(this.instance.fov - this._smoothFov) > 0.05) {
      this.instance.fov = this._smoothFov
      this.instance.updateProjectionMatrix()
    }

    this._shakeTime += dt * (8 + this._smoothShakeIntensity * 12)
    const shakeAmp = this._smoothShakeIntensity * 0.04
    const shakeX = Math.sin(this._shakeTime * 1.1) * shakeAmp
    const shakeY = Math.sin(this._shakeTime * 1.7) * shakeAmp * 0.6

    _yawQuat.setFromAxisAngle(_yAxis, this.target.rotation.y)
    this._smoothQuaternion.slerp(_yawQuat, 8.0 * dt)

    if (this._cinematic) {
      const cin = this._cinematic
      const elapsed = performance.now() - cin.startTime
      const t = Math.min(elapsed / cin.duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)

      const angle = cin.startAngle + (cin.endAngle - cin.startAngle) * eased
      const radius = cin.startRadius + (cin.endRadius - cin.startRadius) * eased
      const y = cin.startY + (cin.endY - cin.startY) * eased

      this.offset.set(Math.sin(angle) * radius, y, Math.cos(angle) * radius)
      this.lookAtOffset.lerpVectors(cin.startLookAt, cin.endLookAt, eased)

      _tmpVec.copy(this.offset).applyQuaternion(this._smoothQuaternion).add(this.target.position)
      this.instance.position.copy(_tmpVec)

      _tmpVec.copy(this.lookAtOffset).applyQuaternion(this._smoothQuaternion).add(this.target.position)
      this.currentLookAt.copy(_tmpVec)
      this.instance.lookAt(this.currentLookAt)

      if (t >= 1) {
        this.targetOffset.copy(this.offset)
        this.targetLookAtOffset.copy(this.lookAtOffset)
        const cb = cin.callback
        this._cinematic = null
        cb?.()
      }
      return
    }

    this.offset.lerp(this.targetOffset, 2.0 * dt)
    this.lookAtOffset.lerp(this.targetLookAtOffset, 2.0 * dt)

    _tmpVec.copy(this.offset).applyQuaternion(this._smoothQuaternion).add(this.target.position)
    this.instance.position.lerp(_tmpVec, this.lerpSpeed * dt)

    this.instance.position.x += shakeX
    this.instance.position.y += shakeY

    _tmpVec.copy(this.lookAtOffset).applyQuaternion(this._smoothQuaternion).add(this.target.position)
    this.currentLookAt.lerp(_tmpVec, this.lerpSpeed * dt)
    this.instance.lookAt(this.currentLookAt)
  }
}
