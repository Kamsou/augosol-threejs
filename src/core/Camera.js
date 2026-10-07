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
    this._targetSpeedRatio = 0
    this._impulse = 0
    this._impulseTime = 0
    this._photo = null

    this.sizes.on('resize', () => this.resize())
  }

  // Brief widening of the view (take-off), decays on its own
  addFovKick(amount) {
    this._fovKick = Math.min((this._fovKick || 0) + amount, 8)
  }

  // One-off jolt (landing from a jump), decays on its own
  addShake(amount) {
    this._impulse = Math.min(this._impulse + amount, 0.6)
    this._impulseTime = 0
  }

  enterPhotoMode() {
    if (!this.target) return
    _tmpVec.subVectors(this.instance.position, this.target.position)
    const dist = THREE.MathUtils.clamp(_tmpVec.length(), 6, 26)
    this._photo = {
      yaw: Math.atan2(_tmpVec.x, _tmpVec.z),
      pitch: THREE.MathUtils.clamp(Math.asin(_tmpVec.y / _tmpVec.length()), -0.05, 1.2),
      dist,
      targetYaw: Math.atan2(_tmpVec.x, _tmpVec.z),
      targetPitch: THREE.MathUtils.clamp(Math.asin(_tmpVec.y / _tmpVec.length()), -0.05, 1.2),
      targetDist: dist,
      idle: 0,
    }
  }

  exitPhotoMode() {
    this._photo = null
  }

  // Welcome screen: slow turntable around the horse, framed off-centre so the text has room.
  // lateral > 0 pushes the horse to the right of the frame, lift < 0 raises it.
  enterIntro({ lateral = 0, lift = 0, distance = 12, pitch = 0.16 } = {}) {
    if (!this.target) return
    const yaw = this.target.rotation.y + Math.PI * 0.72
    this._photo = {
      yaw, pitch, dist: distance,
      targetYaw: yaw, targetPitch: pitch, targetDist: distance,
      idle: Infinity,
      spin: 0.05,
      lateral, lift,
    }
  }

  orbit(dx, dy) {
    if (!this._photo) return
    this._photo.targetYaw -= dx * 0.006
    this._photo.targetPitch = THREE.MathUtils.clamp(this._photo.targetPitch + dy * 0.004, -0.05, 1.2)
    this._photo.idle = 0
  }

  zoom(delta) {
    if (!this._photo) return
    this._photo.targetDist = THREE.MathUtils.clamp(this._photo.targetDist * Math.exp(delta * 0.0012), 5, 30)
    this._photo.idle = 0
  }

  _updatePhoto(dt) {
    const ph = this._photo
    ph.idle += dt
    // Slow turntable once the user lets go
    if (ph.idle > 2.5) ph.targetYaw += dt * (ph.spin ?? 0.12)

    const k = Math.min(dt * 6, 1)
    ph.yaw += (ph.targetYaw - ph.yaw) * k
    ph.pitch += (ph.targetPitch - ph.pitch) * k
    ph.dist += (ph.targetDist - ph.dist) * k

    const cosP = Math.cos(ph.pitch)
    _tmpVec.set(
      Math.sin(ph.yaw) * cosP * ph.dist,
      Math.sin(ph.pitch) * ph.dist + 2.0,
      Math.cos(ph.yaw) * cosP * ph.dist
    ).add(this.target.position)
    this.instance.position.copy(_tmpVec)
    this.currentLookAt.copy(this.target.position).y += 2.2 + (ph.lift || 0)
    if (ph.lateral) {
      // Aim to the left of the horse (camera right = cos yaw, -sin yaw) so it sits to the right
      this.currentLookAt.x -= Math.cos(ph.yaw) * ph.lateral
      this.currentLookAt.z += Math.sin(ph.yaw) * ph.lateral
    }
    this.instance.lookAt(this.currentLookAt)

    if (Math.abs(this.instance.fov - CAMERA.fov) > 0.05) {
      this._smoothFov = CAMERA.fov
      this.instance.fov = CAMERA.fov
      this.instance.updateProjectionMatrix()
    }
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

    if (this._photo) {
      this._updatePhoto(dt)
      return
    }

    const speedRatio = this._targetSpeedRatio || 0
    this._smoothShakeIntensity = THREE.MathUtils.lerp(this._smoothShakeIntensity, speedRatio, 3 * dt)

    this._fovKick = (this._fovKick || 0) * Math.exp(-dt * 3)
    const targetFov = CAMERA.fov + this._smoothShakeIntensity * 7 + this._fovKick
    this._smoothFov = THREE.MathUtils.lerp(this._smoothFov, targetFov, 3 * dt)
    if (Math.abs(this.instance.fov - this._smoothFov) > 0.05) {
      this.instance.fov = this._smoothFov
      this.instance.updateProjectionMatrix()
    }

    let shakeX = 0, shakeY = 0
    const shakeAmp = this._smoothShakeIntensity * 0.04
    if (shakeAmp > 0.0005) {
      this._shakeTime += dt * (8 + this._smoothShakeIntensity * 12)
      shakeX = Math.sin(this._shakeTime * 1.1) * shakeAmp
      shakeY = Math.sin(this._shakeTime * 1.7) * shakeAmp * 0.6
    }

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

    if (this._impulse > 0.001) {
      this._impulseTime += dt
      this.instance.position.y -= Math.cos(this._impulseTime * 32) * this._impulse * 0.5
      this._impulse *= Math.exp(-dt * 7)
    }

    _tmpVec.copy(this.lookAtOffset).applyQuaternion(this._smoothQuaternion).add(this.target.position)
    this.currentLookAt.lerp(_tmpVec, this.lerpSpeed * dt)
    this.instance.lookAt(this.currentLookAt)
  }
}
