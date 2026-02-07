import * as THREE from 'three'
import { INTERACTION_RADIUS } from '../utils/Constants.js'

export default class PensionLocation {
  constructor(config, terrain, assetManager) {
    this.name = config.name
    this.description = config.description
    this.position = config.position.clone()
    this.color = new THREE.Color(config.color)
    this.features = config.features
    this.ethical = config.ethical
    this.radius = INTERACTION_RADIUS
    this.assets = assetManager

    this.position.y = terrain.getHeightAt(this.position.x, this.position.z)

    this.group = new THREE.Group()
    this.group.position.copy(this.position)

    this.isPlayerNear = false

    this._createBeacon()
    this._time = 0
  }

  _placeAsset(name, position, rotation = 0, scale = 1, tintColor = null) {
    if (!this.assets || !this.assets.has(name)) return null
    const clone = this.assets.getSceneClone(name)
    if (!clone) return null

    clone.position.set(position.x || 0, position.y || 0, position.z || 0)
    if (typeof rotation === 'number') {
      clone.rotation.y = rotation
    } else {
      clone.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0)
    }
    if (typeof scale === 'number') {
      clone.scale.multiplyScalar(scale)
    }
    if (tintColor) {
      clone.traverse(child => {
        if (child.isMesh) {
          child.material.color.lerp(new THREE.Color(tintColor), 0.5)
        }
      })
    }
    this.group.add(clone)
    return clone
  }

  _createBeacon() {
    const beaconGeo = new THREE.CylinderGeometry(0.3, 0.5, 40, 6)
    const beaconMat = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: this.ethical ? 0.15 : 0.08,
      side: THREE.DoubleSide,
    })
    this.beacon = new THREE.Mesh(beaconGeo, beaconMat)
    this.beacon.position.y = 20
    this.group.add(this.beacon)

    const glowGeo = new THREE.SphereGeometry(this.ethical ? 1.0 : 0.6, 8, 6)
    const glowMat = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: this.ethical ? 0.5 : 0.3,
    })
    this.beaconGlow = new THREE.Mesh(glowGeo, glowMat)
    this.beaconGlow.position.y = 40
    this.group.add(this.beaconGlow)

    this.light = new THREE.PointLight(this.color, this.ethical ? 2 : 1, 30)
    this.light.position.y = 3
    this.group.add(this.light)

    const ringGeo = new THREE.RingGeometry(this.radius - 0.5, this.radius, 32)
    ringGeo.rotateX(-Math.PI / 2)
    const ringMat = new THREE.MeshBasicMaterial({
      color: this.color,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    })
    this.ring = new THREE.Mesh(ringGeo, ringMat)
    this.ring.position.y = 0.1
    this.group.add(this.ring)
  }

  build() {
  }

  update(dt) {
    this._time += dt

    const baseOpacity = this.ethical ? 0.12 : 0.06
    const pulse = baseOpacity + Math.sin(this._time * 2) * 0.05
    this.beacon.material.opacity = pulse

    const glowBase = this.ethical ? 0.4 : 0.2
    this.beaconGlow.material.opacity = glowBase + Math.sin(this._time * 2.5) * 0.15

    this.beaconGlow.position.y = 40 + Math.sin(this._time * 1.5) * 0.5
  }

  addToScene(scene) {
    scene.add(this.group)
  }
}
