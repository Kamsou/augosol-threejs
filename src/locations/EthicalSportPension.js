import * as THREE from 'three'
import PensionLocation from './PensionLocation.js'

export default class EthicalSportPension extends PensionLocation {
  build() {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, flatShading: true })
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, flatShading: true })
    const amberMat = new THREE.MeshStandardMaterial({ color: 0xc77b2e, flatShading: true })

    const grassGeo = new THREE.CircleGeometry(18, 24)
    grassGeo.rotateX(-Math.PI / 2)
    const grass = new THREE.Mesh(grassGeo, new THREE.MeshStandardMaterial({
      color: 0x6a9a4a, flatShading: true, roughness: 0.95,
    }))
    grass.position.y = 0.01
    this.group.add(grass)

    const arenaGeo = new THREE.CircleGeometry(7, 16)
    arenaGeo.rotateX(-Math.PI / 2)
    const arena = new THREE.Mesh(arenaGeo, new THREE.MeshStandardMaterial({
      color: 0xc4a870, flatShading: true, roughness: 1.0,
    }))
    arena.position.set(0, 0.02, 0)
    this.group.add(arena)

    const arenaCorners = [[-6, -4], [6, -4], [6, 4], [-6, 4]]
    for (let i = 0; i < 4; i++) {
      const a = arenaCorners[i]
      const b = arenaCorners[(i + 1) % 4]
      const dx = b[0] - a[0]
      const dz = b[1] - a[1]
      const len = Math.sqrt(dx * dx + dz * dz)
      const angle = -Math.atan2(dz, dx)
      const steps = Math.floor(len / 2.5)

      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        const pos = { x: a[0] + dx * t, y: 0, z: a[1] + dz * t }
        if (!this._placeAsset('fence_wood', pos, angle, 0.4, 0xeeeeee)) {
          const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.06, 0.06, 1.2, 5),
            whiteMat
          )
          post.position.set(pos.x, 0.6, pos.z)
          this.group.add(post)
        }
      }

      for (const h of [0.35, 0.7]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(len, 0.06, 0.06),
          whiteMat
        )
        rail.position.set((a[0] + b[0]) / 2, h, (a[1] + b[1]) / 2)
        rail.rotation.y = angle
        this.group.add(rail)
      }
    }

    const obstacles = [
      { x: 0, z: -1.5, rot: 0 },
      { x: -3, z: 1.5, rot: Math.PI / 6 },
    ]
    for (const obs of obstacles) {
      const obstacleGroup = new THREE.Group()
      obstacleGroup.position.set(obs.x, 0, obs.z)
      obstacleGroup.rotation.y = obs.rot

      for (const side of [-1, 1]) {
        const upright = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 1.5, 0.2),
          woodMat
        )
        upright.position.set(side * 1.5, 0.75, 0)
        upright.castShadow = true
        obstacleGroup.add(upright)
      }

      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 3, 6),
        amberMat
      )
      pole.rotation.z = Math.PI / 2
      pole.position.y = 0.8
      pole.castShadow = true
      obstacleGroup.add(pole)

      this.group.add(obstacleGroup)
    }

    const paddockGrassGeo = new THREE.PlaneGeometry(8, 9)
    paddockGrassGeo.rotateX(-Math.PI / 2)
    const paddockGrass = new THREE.Mesh(paddockGrassGeo, new THREE.MeshStandardMaterial({
      color: 0x5a8a3a, flatShading: true, roughness: 1.0,
    }))
    paddockGrass.position.set(11.5, 0.015, 0)
    this.group.add(paddockGrass)

    const paddockCorners = [[8, -4], [15, -4], [15, 4], [8, 4]]
    for (let i = 0; i < 4; i++) {
      const a = paddockCorners[i]
      const b = paddockCorners[(i + 1) % 4]
      const dx = b[0] - a[0]
      const dz = b[1] - a[1]
      const len = Math.sqrt(dx * dx + dz * dz)
      const angle = -Math.atan2(dz, dx)

      const steps = Math.floor(len / 2.5)
      for (let s = 0; s <= steps; s++) {
        const t = s / steps
        this._placeAsset('fence_wood', {
          x: a[0] + dx * t, y: 0, z: a[1] + dz * t,
        }, angle, 0.5)
      }

      for (const h of [0.4, 0.8]) {
        const rail = new THREE.Mesh(
          new THREE.BoxGeometry(len, 0.06, 0.06),
          woodMat
        )
        rail.position.set((a[0] + b[0]) / 2, h, (a[1] + b[1]) / 2)
        rail.rotation.y = angle
        this.group.add(rail)
      }
    }

    const stableMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, flatShading: true })
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a3020, flatShading: true })
    const stable = new THREE.Mesh(new THREE.BoxGeometry(5, 2.5, 4), stableMat)
    stable.position.set(-10, 1.25, 0)
    stable.castShadow = true
    this.group.add(stable)
    const stableRoof = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.25, 4.5), roofMat)
    stableRoof.position.set(-10, 2.6, 0)
    stableRoof.castShadow = true
    this.group.add(stableRoof)

    const doorMat = new THREE.MeshStandardMaterial({ color: 0x3a2510, flatShading: true })
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2), doorMat)
    door.position.set(-10, 1, 2.01)
    this.group.add(door)

    const troughMat = new THREE.MeshStandardMaterial({ color: 0x666666, flatShading: true })
    const trough = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.6), troughMat)
    trough.position.set(11, 0.3, 0)
    this.group.add(trough)

    const water = new THREE.Mesh(
      new THREE.BoxGeometry(1.3, 0.05, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x4488aa, metalness: 0.3, roughness: 0.1 })
    )
    water.position.set(11, 0.5, 0)
    this.group.add(water)

    const hayMat = new THREE.MeshStandardMaterial({ color: 0xccaa44, flatShading: true, roughness: 1.0 })
    for (const pos of [{ x: 9, z: -2 }, { x: 10, z: 2 }, { x: -8, z: -3 }]) {
      const hay = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.8, 8), hayMat)
      hay.position.set(pos.x, 0.4, pos.z)
      hay.rotation.x = Math.PI / 2
      hay.castShadow = true
      this.group.add(hay)
    }

    const treeTypes = ['tree_oak', 'tree_birch', 'tree_pine']
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2
      const r = 16 + Math.random() * 4
      const type = treeTypes[i % treeTypes.length]
      this._placeAsset(type, {
        x: Math.cos(angle) * r, y: 0, z: Math.sin(angle) * r,
      }, Math.random() * Math.PI * 2, 0.6 + Math.random() * 0.4)
    }

    for (const pos of [{ x: 7, z: -5 }, { x: 7, z: 5 }, { x: 16, z: 0 }, { x: -14, z: 3 }, { x: -14, z: -3 }]) {
      this._placeAsset(Math.random() > 0.5 ? 'bush_1' : 'bush_2', pos, Math.random() * Math.PI * 2, 0.6 + Math.random() * 0.3)
    }

    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 13 + Math.random() * 5
      this._placeAsset(i % 2 === 0 ? 'flower_1' : 'flower_2', {
        x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r,
      }, Math.random() * Math.PI * 2, 0.3 + Math.random() * 0.3)
    }

    for (const pos of [{ x: -6, z: -5 }, { x: 6, z: -5 }, { x: 0, z: 5 }]) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 2.2, 4),
        woodMat
      )
      pole.position.set(pos.x, 1.1, pos.z)
      this.group.add(pole)

      const lantern = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 0.3, 0.25),
        new THREE.MeshBasicMaterial({ color: 0xffaa44 })
      )
      lantern.position.set(pos.x, 2.3, pos.z)
      this.group.add(lantern)

      const light = new THREE.PointLight(0xffaa44, 0.8, 10)
      light.position.set(pos.x, 2.3, pos.z)
      this.group.add(light)
    }
  }
}
