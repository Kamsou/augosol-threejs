import * as THREE from 'three'
import PensionLocation from './PensionLocation.js'

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

export default class ShowpiecePension extends PensionLocation {
  build() {
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xb8860b, metalness: 0.5, roughness: 0.3, flatShading: true,
    })
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, flatShading: true, roughness: 0.2 })
    const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x2a5a2a, flatShading: true })

    const floorGeo = new THREE.CircleGeometry(14, 20)
    floorGeo.rotateX(-Math.PI / 2)
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({
      color: 0xd4ccc0, flatShading: true, roughness: 0.3, metalness: 0.05,
    }))
    floor.position.y = 0.01
    this.group.add(floor)

    const borderGeo = new THREE.RingGeometry(14, 18, 24)
    borderGeo.rotateX(-Math.PI / 2)
    const border = new THREE.Mesh(borderGeo, new THREE.MeshStandardMaterial({
      color: 0xb0a898, flatShading: true, roughness: 0.8,
    }))
    border.position.y = 0.005
    this.group.add(border)

    const hedgePositions = [
      { x: -9, z: -7 }, { x: 9, z: -7 }, { x: -9, z: 7 }, { x: 9, z: 7 },
      { x: -5, z: -9 }, { x: 5, z: -9 },
    ]
    for (const h of hedgePositions) {
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), hedgeMat)
      base.position.set(h.x, 0.9, h.z)
      base.castShadow = true
      this.group.add(base)

      if (!this._placeAsset('bush_1', { x: h.x, y: 2, z: h.z }, 0, 0.5)) {
        const topiary = new THREE.Mesh(new THREE.SphereGeometry(1.0, 8, 6), hedgeMat)
        topiary.position.set(h.x, 2.8, h.z)
        topiary.castShadow = true
        this.group.add(topiary)
      }
    }

    for (const wall of [
      { x: 0, z: -9, len: 8 },
      { x: 0, z: 9, len: 14 },
    ]) {
      const hedge = new THREE.Mesh(
        new THREE.BoxGeometry(wall.len, 1.8, 0.8),
        hedgeMat
      )
      hedge.position.set(wall.x, 0.9, wall.z)
      hedge.castShadow = true
      this.group.add(hedge)
    }

    for (const side of [-1, 1]) {
      const pillar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 3, 8),
        whiteMat
      )
      pillar.position.set(side * 3, 1.5, -10)
      pillar.castShadow = true
      this.group.add(pillar)

      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), goldMat)
      ball.position.set(side * 3, 3.2, -10)
      this.group.add(ball)
    }

    const archMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, flatShading: true })
    const archLeft = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.5, 0.3), archMat)
    archLeft.position.set(-2, 1.75, 0)
    this.group.add(archLeft)

    const archRight = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.5, 0.3), archMat)
    archRight.position.set(2, 1.75, 0)
    this.group.add(archRight)

    const archTop = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.3, 0.3), archMat)
    archTop.position.set(0, 3.65, 0)
    this.group.add(archTop)

    const ribbonMat = new THREE.MeshStandardMaterial({
      color: 0xb8860b, flatShading: true, side: THREE.DoubleSide,
    })
    const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.5), ribbonMat)
    ribbon.position.set(0, 3.2, 0.2)
    this.group.add(ribbon)

    for (let i = 0; i < 10; i++) {
      const side = i < 5 ? -1 : 1
      const type = i % 2 === 0 ? 'flower_1' : 'flower_2'
      this._placeAsset(type, {
        x: side * 2 + (Math.random() - 0.5) * 0.8,
        y: 0,
        z: (Math.random() - 0.5) * 3,
      }, Math.random() * Math.PI * 2, 0.3 + Math.random() * 0.3)
    }

    const lightColors = [0xff44aa, 0x44aaff, 0xffaa00]
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2
      const r = 11
      const lx = Math.cos(angle) * r
      const lz = Math.sin(angle) * r

      const lightPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 3.5, 4),
        new THREE.MeshStandardMaterial({ color: 0xaaaaaa, flatShading: true })
      )
      lightPole.position.set(lx, 1.75, lz)
      this.group.add(lightPole)

      const spotHead = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.15, 0.2),
        new THREE.MeshBasicMaterial({ color: lightColors[i] })
      )
      spotHead.position.set(lx, 3.5, lz)
      this.group.add(spotHead)

      if (!isMobile) {
        const spotLight = new THREE.PointLight(lightColors[i], 1.2, 15)
        spotLight.position.set(lx, 3.5, lz)
        this.group.add(spotLight)
      }
    }

    const standMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, flatShading: true, roughness: 0.2 })
    for (const pos of [{ x: -5, z: 3 }, { x: 5, z: 3 }]) {
      const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(1.2, 1.2, 0.3, 8),
        standMat
      )
      stand.position.set(pos.x, 0.15, pos.z)
      this.group.add(stand)
    }

    const mirrorMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeff, metalness: 0.8, roughness: 0.05, flatShading: true,
    })
    for (const pos of [{ x: -7, z: 0 }, { x: 7, z: 0 }]) {
      const mirror = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.5), mirrorMat)
      mirror.position.set(pos.x, 1.25, pos.z)
      mirror.rotation.y = pos.x > 0 ? -Math.PI / 6 : Math.PI / 6
      this.group.add(mirror)
    }
  }
}
