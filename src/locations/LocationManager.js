import * as THREE from 'three'
import { PENSIONS, INTERACTION_RADIUS, APPROACH_RADIUS } from '../utils/Constants.js'

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
import NaturePension from './NaturePension.js'
import EthicalSportPension from './EthicalSportPension.js'
import WellnessPension from './WellnessPension.js'
import IntensivePension from './IntensivePension.js'
import NeglectPension from './NeglectPension.js'
import ShowpiecePension from './ShowpiecePension.js'

const PENSION_CLASSES = {
  nature: NaturePension,
  ethical_sport: EthicalSportPension,
  wellness: WellnessPension,
  intensive: IntensivePension,
  neglect: NeglectPension,
  showpiece: ShowpiecePension,
}

export default class LocationManager {
  constructor(scene, terrain, assetManager) {
    this.locations = {}
    this.nearestLocation = null
    this.isInRange = false
    this._listeners = { approach: [], leave: [], nearest: [] }

    this._beacons = []

    for (const [key, config] of Object.entries(PENSIONS)) {
      const PensionClass = PENSION_CLASSES[key]
      const location = new PensionClass(config, terrain, assetManager)
      location.build()
      location.addToScene(scene)
      this.locations[key] = location

      const beacon = this._createBeacon(config.color, config.ethical)
      beacon.position.copy(config.position)
      beacon.position.y = terrain.getHeightAt(config.position.x, config.position.z) + 0.5
      scene.add(beacon)
      this._beacons.push(beacon)
    }

    this._beaconTime = 0
    this._beaconFrame = 0
    this._locationEntries = Object.entries(this.locations)
  }

  _createBeacon(color, ethical) {
    const group = new THREE.Group()

    const pillarGeo = new THREE.CylinderGeometry(0.15, 0.6, 20, isMobile ? 4 : 8, 1, true)
    const pillarMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const pillar = new THREE.Mesh(pillarGeo, pillarMat)
    pillar.position.y = 10
    group.add(pillar)

    const ringGeo = new THREE.RingGeometry(2, 4, isMobile ? 12 : 24)
    ringGeo.rotateX(-Math.PI / 2)
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.position.y = 0.1
    group.add(ring)

    const orbGeo = new THREE.SphereGeometry(0.4, isMobile ? 6 : 12, isMobile ? 4 : 8)
    const orbMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
    })
    const orb = new THREE.Mesh(orbGeo, orbMat)
    orb.position.y = 22
    group.add(orb)

    let light = null
    if (!isMobile) {
      light = new THREE.PointLight(color, ethical ? 1.5 : 0.8, 30)
      light.position.y = 22
      group.add(light)
    }

    group.userData = { pillarMat, ringMat, orbMat, orb, light }

    return group
  }

  on(event, fn) {
    if (this._listeners[event]) this._listeners[event].push(fn)
  }

  update(dt, horsePosition) {
    this._beaconTime += dt
    this._beaconFrame++
    if (!isMobile || this._beaconFrame % 3 === 0) {
      for (const beacon of this._beacons) {
        const ud = beacon.userData
        const pulse = 0.5 + Math.sin(this._beaconTime * 2) * 0.5
        ud.pillarMat.opacity = 0.05 + pulse * 0.06
        ud.ringMat.opacity = 0.08 + pulse * 0.08
        ud.orbMat.opacity = 0.35 + pulse * 0.25
        ud.orb.position.y = 22 + Math.sin(this._beaconTime * 1.5) * 0.5
        if (ud.light) ud.light.intensity = (ud.light.intensity > 1 ? 1.2 : 0.6) + pulse * 0.5
      }
    }

    let closest = null
    let closestDist = Infinity

    for (const [key, location] of this._locationEntries) {
      location.update(dt)

      const dist = horsePosition.distanceTo(location.position)

      if (dist < closestDist) {
        closestDist = dist
        closest = { key, location, distance: dist }
      }
    }

    const wasInRange = this.isInRange
    const previousNearest = this.nearestLocation

    if (closest && closestDist < INTERACTION_RADIUS) {
      this.isInRange = true
      this.nearestLocation = closest

      if (!wasInRange) {
        this._listeners.approach.forEach(fn => fn(closest))
      }
    } else {
      this.isInRange = false
      this.nearestLocation = closestDist < APPROACH_RADIUS ? closest : null

      if (wasInRange) {
        this._listeners.leave.forEach(fn => fn(previousNearest))
      }
    }
  }

  getLocationsWorldData() {
    if (this._worldDataCache) return this._worldDataCache
    const data = []
    for (const [key, location] of this._locationEntries) {
      const config = PENSIONS[key]
      data.push({
        key,
        name: config.name,
        color: '#' + new THREE.Color(config.color).getHexString(),
        ethical: config.ethical,
        x: location.position.x,
        z: location.position.z,
      })
    }
    this._worldDataCache = data
    return data
  }
}
