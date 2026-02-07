import * as THREE from 'three'
import { COLORS } from '../utils/Constants.js'

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

export default class Lighting {
  constructor(scene) {
    this.hemisphere = new THREE.HemisphereLight(0xffe5c4, 0x8a7040, 0.7)
    scene.add(this.hemisphere)

    this.sun = new THREE.DirectionalLight(COLORS.sun, 2.0)
    this.sun.position.set(40, 60, 25)
    this.sun.castShadow = true
    const shadowRes = isMobile ? 512 : 2048
    this.sun.shadow.mapSize.set(shadowRes, shadowRes)
    this.sun.shadow.camera.near = 1
    this.sun.shadow.camera.far = 250
    this.sun.shadow.camera.left = -35
    this.sun.shadow.camera.right = 35
    this.sun.shadow.camera.top = 35
    this.sun.shadow.camera.bottom = -35
    this.sun.shadow.bias = -0.0003
    this.sun.shadow.normalBias = 0.04
    scene.add(this.sun)
    scene.add(this.sun.target)

    this.rimLight = new THREE.DirectionalLight(0x88aacc, 0.35)
    this.rimLight.position.set(-30, 40, -20)
    scene.add(this.rimLight)

    this.fillLight = new THREE.DirectionalLight(0xffeedd, 0.5)
    this.fillLight.position.set(-10, 5, 10)
    scene.add(this.fillLight)

    this.ambient = new THREE.AmbientLight(COLORS.ambient, 0.35)
    scene.add(this.ambient)
  }

  update(dt, horsePosition) {
    if (horsePosition) {
      this.sun.target.position.copy(horsePosition)
      this.sun.position.set(
        horsePosition.x + 40,
        60,
        horsePosition.z + 25
      )
      this.rimLight.position.set(
        horsePosition.x - 30,
        40,
        horsePosition.z - 20
      )
      this.fillLight.position.set(
        horsePosition.x - 10,
        5,
        horsePosition.z + 10
      )
    }
  }
}
