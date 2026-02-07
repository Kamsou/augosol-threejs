import * as THREE from 'three'
import PensionLocation from './PensionLocation.js'

export default class NeglectPension extends PensionLocation {
  build() {
    const rotWoodMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, flatShading: true, roughness: 1.0 })
    const rustMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, flatShading: true, roughness: 0.9 })

    const mudGeo = new THREE.CircleGeometry(16, 12)
    mudGeo.rotateX(-Math.PI / 2)
    const mud = new THREE.Mesh(mudGeo, new THREE.MeshStandardMaterial({
      color: 0x5a4a30, flatShading: true, roughness: 1.0,
    }))
    mud.position.y = 0.01
    this.group.add(mud)

    for (let i = 0; i < 7; i++) {
      const puddle = new THREE.Mesh(
        new THREE.CircleGeometry(1.0 + Math.random() * 1.5, 8),
        new THREE.MeshStandardMaterial({
          color: 0x4a3a20, metalness: 0.2, roughness: 0.2,
          transparent: true, opacity: 0.7,
        })
      )
      puddle.rotation.x = -Math.PI / 2
      puddle.position.set(
        (Math.random() - 0.5) * 20,
        0.03,
        (Math.random() - 0.5) * 20
      )
      this.group.add(puddle)
    }

    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2
      const r = 14
      const pos = { x: Math.cos(angle) * r, y: 0, z: Math.sin(angle) * r }
      const isBroken = Math.random() > 0.4

      const placed = this._placeAsset('fence_wood', pos, angle + Math.PI / 2, 0.5)
      if (placed) {
        if (isBroken) {
          placed.rotation.z = (Math.random() - 0.5) * 0.6
          placed.rotation.x = (Math.random() - 0.5) * 0.3
        }
      } else {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 1.2, 4),
          rotWoodMat
        )
        post.position.set(pos.x, 0.5, pos.z)
        if (isBroken) {
          post.rotation.z = (Math.random() - 0.5) * 0.6
          post.rotation.x = (Math.random() - 0.5) * 0.4
        }
        this.group.add(post)

        if (i % 3 !== 0) {
          const nextAngle = ((i + 1) / 14) * Math.PI * 2
          const ax = Math.cos(angle) * r, az = Math.sin(angle) * r
          const bx = Math.cos(nextAngle) * r, bz = Math.sin(nextAngle) * r
          const dx = bx - ax, dz = bz - az
          const len = Math.sqrt(dx * dx + dz * dz)

          const rail = new THREE.Mesh(
            new THREE.BoxGeometry(len, 0.06, 0.06),
            rotWoodMat
          )
          rail.position.set((ax + bx) / 2, 0.6, (az + bz) / 2)
          rail.rotation.y = -Math.atan2(dz, dx)
          if (Math.random() > 0.5) rail.rotation.z = (Math.random() - 0.5) * 0.2
          this.group.add(rail)
        }
      }
    }

    const shelterGroup = new THREE.Group()
    shelterGroup.rotation.z = 0.08

    const shelterPosts = [[-3, -3], [-3, 0], [0, -3], [0, 0]]
    for (const [sx, sz] of shelterPosts) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 2.0, 4),
        rotWoodMat
      )
      post.position.set(sx, 1.0, sz)
      this.group.add(post)
    }

    const roof1 = new THREE.Mesh(new THREE.BoxGeometry(2, 0.1, 3.5), rustMat)
    roof1.position.set(-2, 2.1, -1.5)
    shelterGroup.add(roof1)

    const roof2 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 2), rustMat)
    roof2.position.set(-0.5, 2.0, -2)
    roof2.rotation.z = 0.05
    shelterGroup.add(roof2)

    this.group.add(shelterGroup)

    const bucket = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.25, 0.5, 6),
      rustMat
    )
    bucket.position.set(4, 0.15, 2)
    bucket.rotation.z = Math.PI / 3
    this.group.add(bucket)

    const trough = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 0.5), rotWoodMat)
    trough.position.set(-5, 0.2, 4)
    this.group.add(trough)

    for (let i = 0; i < 12; i++) {
      const debris = new THREE.Mesh(
        new THREE.BoxGeometry(
          0.2 + Math.random() * 0.4,
          0.05 + Math.random() * 0.1,
          0.1 + Math.random() * 0.3
        ),
        rotWoodMat
      )
      debris.position.set(
        (Math.random() - 0.5) * 22,
        0.05,
        (Math.random() - 0.5) * 22
      )
      debris.rotation.y = Math.random() * Math.PI
      this.group.add(debris)
    }

    for (const pos of [{ x: 6, z: -5 }, { x: -8, z: -7 }]) {
      if (!this._placeAsset('dead_tree', { x: pos.x, y: 0, z: pos.z }, Math.random() * Math.PI, 0.7 + Math.random() * 0.3)) {
        const deadTrunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.15, 0.25, 3, 5),
          new THREE.MeshStandardMaterial({ color: 0x6a5a4a, flatShading: true })
        )
        deadTrunk.position.set(pos.x, 1.5, pos.z)
        this.group.add(deadTrunk)

        for (let b = 0; b < 3; b++) {
          const branch = new THREE.Mesh(
            new THREE.CylinderGeometry(0.03, 0.06, 1.5, 3),
            new THREE.MeshStandardMaterial({ color: 0x6a5a4a, flatShading: true })
          )
          branch.position.set(pos.x + (Math.random() - 0.5) * 0.5, 3 + b * 0.3, pos.z)
          branch.rotation.z = (Math.random() - 0.5) * 1.2
          this.group.add(branch)
        }
      }
    }

    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 10 + Math.random() * 4
      this._placeAsset('grass_clump', {
        x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r,
      }, Math.random() * Math.PI * 2, 0.3 + Math.random() * 0.2)
    }

    const rockTypes = ['rock_1', 'rock_2']
    for (let i = 0; i < 6; i++) {
      this._placeAsset(rockTypes[i % 2], {
        x: (Math.random() - 0.5) * 20,
        y: 0,
        z: (Math.random() - 0.5) * 20,
      }, Math.random() * Math.PI * 2, 0.2 + Math.random() * 0.3)
    }
  }
}
