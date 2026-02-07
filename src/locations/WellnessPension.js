import * as THREE from 'three'
import PensionLocation from './PensionLocation.js'

export default class WellnessPension extends PensionLocation {
  build() {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, flatShading: true })
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x999990, flatShading: true, roughness: 0.9 })
    const sageMat = new THREE.MeshStandardMaterial({ color: 0x6b8e6b, flatShading: true })

    const grassGeo = new THREE.CircleGeometry(18, 24)
    grassGeo.rotateX(-Math.PI / 2)
    const grass = new THREE.Mesh(grassGeo, new THREE.MeshStandardMaterial({
      color: 0x5a8a3a, flatShading: true, roughness: 0.95,
    }))
    grass.position.y = 0.01
    this.group.add(grass)

    const herbColors = [0x4a7a3a, 0x6b9e5b, 0x8aaa7a, 0x5a8a4a]
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2
      const r = 5
      const cx = Math.cos(angle) * r
      const cz = Math.sin(angle) * r

      const herbGeo = new THREE.CircleGeometry(1.2, 8)
      herbGeo.rotateX(-Math.PI / 2)
      const herb = new THREE.Mesh(herbGeo, new THREE.MeshStandardMaterial({
        color: herbColors[i % herbColors.length],
        flatShading: true,
      }))
      herb.position.set(cx, 0.02, cz)
      this.group.add(herb)

      const bushType = i % 2 === 0 ? 'bush_1' : 'bush_2'
      if (!this._placeAsset(bushType, { x: cx, y: 0, z: cz }, Math.random() * Math.PI * 2, 0.3)) {
        for (let j = 0; j < 5; j++) {
          const plant = new THREE.Mesh(
            new THREE.ConeGeometry(0.1, 0.4, 3),
            sageMat
          )
          plant.position.set(
            cx + (Math.random() - 0.5) * 1.5,
            0.2,
            cz + (Math.random() - 0.5) * 1.5
          )
          this.group.add(plant)
        }
      }
    }

    const sandGeo = new THREE.CircleGeometry(3, 12)
    sandGeo.rotateX(-Math.PI / 2)
    const sand = new THREE.Mesh(sandGeo, new THREE.MeshStandardMaterial({
      color: 0xd4c4a0, flatShading: true, roughness: 1.0,
    }))
    sand.position.set(-6, 0.02, -3)
    this.group.add(sand)

    const rockTypes = ['rock_1', 'rock_2', 'rock_3']
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2
      const pos = {
        x: -6 + Math.cos(angle) * 3.3,
        y: 0,
        z: -3 + Math.sin(angle) * 3.3,
      }
      if (!this._placeAsset(rockTypes[i % 3], pos, Math.random() * Math.PI * 2, 0.15)) {
        const stone = new THREE.Mesh(
          new THREE.SphereGeometry(0.25 + Math.random() * 0.15, 4, 3),
          stoneMat
        )
        stone.position.set(pos.x, 0.1, pos.z)
        stone.scale.y = 0.5
        this.group.add(stone)
      }
    }

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a3020, flatShading: true })
    const shelterPosts = [[5, -5], [5, -2], [9, -5], [9, -2]]
    for (const [sx, sz] of shelterPosts) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.1, 2.5, 4),
        woodMat
      )
      post.position.set(sx, 1.25, sz)
      post.castShadow = true
      this.group.add(post)
    }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 4), roofMat)
    roof.position.set(7, 2.6, -3.5)
    roof.castShadow = true
    this.group.add(roof)

    const treeTypes = ['tree_oak', 'tree_birch', 'tree_pine']
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2
      const r = 15 + Math.random() * 3
      this._placeAsset(treeTypes[i % treeTypes.length], {
        x: Math.cos(angle) * r, y: 0, z: Math.sin(angle) * r,
      }, Math.random() * Math.PI * 2, 0.6 + Math.random() * 0.4)
    }

    for (const pos of [{ x: 0, z: 0 }, { x: 7, z: -3 }, { x: -6, z: 5 }]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 1.5, 5),
        stoneMat
      )
      pole.position.set(pos.x, 0.75, pos.z)
      this.group.add(pole)

      const lantern = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 6, 4),
        new THREE.MeshBasicMaterial({ color: 0xffcc88 })
      )
      lantern.position.set(pos.x, 1.6, pos.z)
      this.group.add(lantern)

      const light = new THREE.PointLight(0xffcc88, 0.8, 8)
      light.position.set(pos.x, 1.6, pos.z)
      this.group.add(light)
    }

    for (let i = 0; i < 3; i++) {
      this._placeAsset(rockTypes[i], { x: 4, y: i * 0.3, z: 5 }, Math.random() * Math.PI, 0.12 + i * 0.05)
    }

    for (const pos of [{ x: -3, z: 7 }, { x: 8, z: 4 }, { x: -8, z: 0 }, { x: 10, z: 2 }]) {
      if (!this._placeAsset('bush_1', pos, Math.random() * Math.PI * 2, 0.7)) {
        const bush = new THREE.Mesh(
          new THREE.SphereGeometry(1.0, 5, 4),
          sageMat
        )
        bush.position.set(pos.x, 0.8, pos.z)
        this.group.add(bush)
      }

      for (let j = 0; j < 4; j++) {
        this._placeAsset('flower_1', {
          x: pos.x + (Math.random() - 0.5) * 1.5,
          y: 0.5 + Math.random() * 0.5,
          z: pos.z + (Math.random() - 0.5) * 1.5,
        }, Math.random() * Math.PI * 2, 0.25)
      }
    }

    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 8 + Math.random() * 8
      this._placeAsset('grass_clump', {
        x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r,
      }, Math.random() * Math.PI * 2, 0.4 + Math.random() * 0.4)
    }
  }
}
