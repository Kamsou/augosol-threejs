import * as THREE from 'three'
import PensionLocation from './PensionLocation.js'

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

export default class IntensivePension extends PensionLocation {
  build() {
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x888888, flatShading: true, roughness: 1.0 })
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x666666, flatShading: true, metalness: 0.3, roughness: 0.4 })
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a, flatShading: true })
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x555555, flatShading: true })

    const floorGeo = new THREE.CircleGeometry(14, 16)
    floorGeo.rotateX(-Math.PI / 2)
    const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({
      color: 0x999999, flatShading: true, roughness: 1.0,
    }))
    floor.position.y = 0.01
    this.group.add(floor)

    const dirtGeo = new THREE.RingGeometry(14, 18, 24)
    dirtGeo.rotateX(-Math.PI / 2)
    const dirt = new THREE.Mesh(dirtGeo, new THREE.MeshStandardMaterial({
      color: 0x8a7a60, flatShading: true, roughness: 1.0,
    }))
    dirt.position.y = 0.005
    this.group.add(dirt)

    const stable = new THREE.Mesh(new THREE.BoxGeometry(14, 3.5, 6), concreteMat)
    stable.position.set(0, 1.75, -4)
    stable.castShadow = true
    this.group.add(stable)

    const stableRoof = new THREE.Mesh(new THREE.BoxGeometry(15, 0.25, 7), roofMat)
    stableRoof.position.set(0, 3.6, -4)
    this.group.add(stableRoof)

    const corridor = new THREE.Mesh(new THREE.BoxGeometry(14, 0.05, 3), concreteMat)
    corridor.position.set(0, 0.03, 0)
    this.group.add(corridor)

    for (let i = 0; i < 5; i++) {
      const sx = -5.5 + i * 2.8

      const wallLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.8, 2.5), darkMat)
      wallLeft.position.set(sx - 1.3, 1.4, 3)
      wallLeft.castShadow = true
      this.group.add(wallLeft)

      const wallBack = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.8, 0.12), darkMat)
      wallBack.position.set(sx, 1.4, 4.25)
      this.group.add(wallBack)

      const door = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.1), metalMat)
      door.position.set(sx, 0.7, 1.75)
      this.group.add(door)

      for (let b = 0; b < 5; b++) {
        const bar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.015, 0.015, 1.2, 4),
          metalMat
        )
        bar.position.set(sx - 1.0 + b * 0.5, 2.0, 1.75)
        this.group.add(bar)
      }

      const stallRoof = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.1, 2.8), roofMat)
      stallRoof.position.set(sx, 2.85, 3)
      this.group.add(stallRoof)
    }

    const wallRight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.8, 2.5), darkMat)
    wallRight.position.set(5.5 + 1.3 - 2.8, 1.4, 3)
    this.group.add(wallRight)

    const fenceMetal = new THREE.MeshStandardMaterial({
      color: 0x777777, flatShading: true, metalness: 0.4, roughness: 0.3,
    })
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2
      const r = 14
      const px = Math.cos(angle) * r
      const pz = Math.sin(angle) * r

      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.8, 4),
        fenceMetal
      )
      post.position.set(px, 0.9, pz)
      this.group.add(post)

      if (i < 19) {
        const nextAngle = ((i + 1) / 20) * Math.PI * 2
        const bx = Math.cos(nextAngle) * r
        const bz = Math.sin(nextAngle) * r
        const dx = bx - px, dz = bz - pz
        const len = Math.sqrt(dx * dx + dz * dz)

        for (const h of [0.4, 0.9, 1.4]) {
          const wire = new THREE.Mesh(
            new THREE.BoxGeometry(len, 0.02, 0.02),
            fenceMetal
          )
          wire.position.set((px + bx) / 2, h, (pz + bz) / 2)
          wire.rotation.y = -Math.atan2(dz, dx)
          this.group.add(wire)
        }
      }
    }

    for (const pos of [{ x: -7, z: -8 }, { x: 7, z: -8 }, { x: 0, z: 10 }]) {
      const spotPole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.08, 5, 4),
        metalMat
      )
      spotPole.position.set(pos.x, 2.5, pos.z)
      this.group.add(spotPole)

      const spotHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 0.35), metalMat)
      spotHead.position.set(pos.x, 5, pos.z)
      this.group.add(spotHead)

      if (!isMobile) {
        const light = new THREE.PointLight(0xccccff, 1.0, 18)
        light.position.set(pos.x, 5, pos.z)
        this.group.add(light)
      }
    }
  }
}
