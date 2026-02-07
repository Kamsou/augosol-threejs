import * as THREE from 'three'
import { createNoise2D } from 'simplex-noise'
import { WORLD_SIZE, PENSIONS } from '../utils/Constants.js'

export default class Vegetation {
  constructor(scene, terrain, assetManager) {
    this.scene = scene
    this.terrain = terrain
    this.assets = assetManager
    this.noise = createNoise2D()

    this._createTrees()
    this._createBushes()
    this._createRocks()
    this._createGrass()
    this._createFlowers()
  }

  _isExcluded(x, z, spawnRadius = 15, pensionRadius = 18) {
    if (Math.sqrt(x * x + z * z) < spawnRadius) return true
    for (const key of Object.keys(PENSIONS)) {
      const pos = PENSIONS[key].position
      if (Math.sqrt((x - pos.x) ** 2 + (z - pos.z) ** 2) < pensionRadius) return true
    }
    return false
  }

  _placeInstanced(assetName, count, placeFn) {
    const parts = this.assets.getInstanceParts(assetName)
    if (!parts) return null

    const dummy = new THREE.Matrix4()
    const meshes = parts.map(part => {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, count)
      mesh.castShadow = true
      mesh.receiveShadow = true
      return mesh
    })

    let placed = 0
    for (let attempt = 0; attempt < count * 4 && placed < count; attempt++) {
      const result = placeFn(attempt)
      if (!result) continue

      const { x, z, scale, rotation } = result
      const y = this.terrain.getHeightAt(x, z)

      dummy.makeRotationY(rotation)
      dummy.scale(new THREE.Vector3(scale, scale, scale))
      dummy.setPosition(x, y, z)

      for (const mesh of meshes) {
        mesh.setMatrixAt(placed, dummy)
      }
      placed++
    }

    for (const mesh of meshes) {
      mesh.count = placed
      mesh.instanceMatrix.needsUpdate = true
      this.scene.add(mesh)
    }

    return meshes
  }

  _createTrees() {
    const treeTypes = ['tree_pine', 'tree_oak', 'tree_birch']
    const countPerType = 45

    for (const type of treeTypes) {
      if (!this.assets.has(type)) {
        this._createFallbackTrees(countPerType * treeTypes.length)
        return
      }
    }

    for (const type of treeTypes) {
      this._placeInstanced(type, countPerType, () => {
        const x = (Math.random() - 0.5) * WORLD_SIZE * 0.9
        const z = (Math.random() - 0.5) * WORLD_SIZE * 0.9
        if (this._isExcluded(x, z)) return null

        const density = this.noise(x * 0.01, z * 0.01)
        if (density < -0.2) return null

        return {
          x, z,
          scale: 0.7 + Math.random() * 0.7,
          rotation: Math.random() * Math.PI * 2,
        }
      })
    }
  }

  _createBushes() {
    const bushTypes = ['bush_1', 'bush_2']
    const countPerType = 30

    for (const type of bushTypes) {
      if (!this.assets.has(type)) continue

      this._placeInstanced(type, countPerType, () => {
        const x = (Math.random() - 0.5) * WORLD_SIZE * 0.85
        const z = (Math.random() - 0.5) * WORLD_SIZE * 0.85
        if (this._isExcluded(x, z, 12, 15)) return null

        const density = this.noise(x * 0.02 + 50, z * 0.02 + 50)
        if (density < -0.1) return null

        return {
          x, z,
          scale: 0.6 + Math.random() * 0.8,
          rotation: Math.random() * Math.PI * 2,
        }
      })
    }
  }

  _createRocks() {
    const rockTypes = ['rock_1', 'rock_2', 'rock_3']
    const countPerType = 15

    for (const type of rockTypes) {
      if (!this.assets.has(type)) continue

      this._placeInstanced(type, countPerType, () => {
        const x = (Math.random() - 0.5) * WORLD_SIZE * 0.85
        const z = (Math.random() - 0.5) * WORLD_SIZE * 0.85
        if (this._isExcluded(x, z, 10, 12)) return null

        return {
          x, z,
          scale: 0.4 + Math.random() * 0.8,
          rotation: Math.random() * Math.PI * 2,
        }
      })
    }
  }

  _createGrass() {
    if (this.assets.has('grass_clump')) {
      this._placeInstanced('grass_clump', 250, () => {
        const x = (Math.random() - 0.5) * WORLD_SIZE * 0.85
        const z = (Math.random() - 0.5) * WORLD_SIZE * 0.85
        return {
          x, z,
          scale: 0.3 + Math.random() * 0.7,
          rotation: Math.random() * Math.PI * 2,
        }
      })
    }

    const bladeGeo = new THREE.ConeGeometry(0.06, 0.4, 3)
    bladeGeo.translate(0, 0.2, 0)
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x6a9e4a,
      flatShading: true,
      roughness: 1.0,
    })

    const count = 1000
    const grass = new THREE.InstancedMesh(bladeGeo, bladeMat, count)
    const dummy = new THREE.Matrix4()

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * WORLD_SIZE * 0.85
      const z = (Math.random() - 0.5) * WORLD_SIZE * 0.85
      const y = this.terrain.getHeightAt(x, z)
      const scale = 0.4 + Math.random() * 0.8

      dummy.makeRotationY(Math.random() * Math.PI * 2)
      dummy.scale(new THREE.Vector3(scale, scale, scale))
      dummy.setPosition(x, y, z)
      grass.setMatrixAt(i, dummy)

      const color = new THREE.Color()
      color.setHSL(0.25 + Math.random() * 0.08, 0.4 + Math.random() * 0.3, 0.3 + Math.random() * 0.2)
      grass.setColorAt(i, color)
    }

    grass.instanceMatrix.needsUpdate = true
    if (grass.instanceColor) grass.instanceColor.needsUpdate = true
    this.scene.add(grass)
  }

  _createFlowers() {
    const flowerTypes = ['flower_1', 'flower_2']
    const countPerType = 80

    for (const type of flowerTypes) {
      if (!this.assets.has(type)) continue
      this._placeInstanced(type, countPerType, () => {
        const x = (Math.random() - 0.5) * WORLD_SIZE * 0.8
        const z = (Math.random() - 0.5) * WORLD_SIZE * 0.8
        return {
          x, z,
          scale: 0.3 + Math.random() * 0.5,
          rotation: Math.random() * Math.PI * 2,
        }
      })
    }

    const flowerGeo = new THREE.SphereGeometry(0.1, 4, 3)
    flowerGeo.translate(0, 0.25, 0)
    const flowerMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.7 })
    const count = 200
    const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, count)

    const flowerColors = [0xf59e0b, 0xfbbf4d, 0xff8a5c, 0xffffff, 0xd4a87a, 0xe8a86b]
    const dummy = new THREE.Matrix4()

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * WORLD_SIZE * 0.8
      const z = (Math.random() - 0.5) * WORLD_SIZE * 0.8
      const y = this.terrain.getHeightAt(x, z)

      dummy.makeRotationY(Math.random() * Math.PI * 2)
      dummy.setPosition(x, y, z)
      flowers.setMatrixAt(i, dummy)
      flowers.setColorAt(i, new THREE.Color(flowerColors[Math.floor(Math.random() * flowerColors.length)]))
    }

    flowers.instanceMatrix.needsUpdate = true
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true
    this.scene.add(flowers)
  }

  _createFallbackTrees(count) {
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.25, 2.0, 5)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4226, flatShading: true, roughness: 0.9 })
    const crownGeo = new THREE.ConeGeometry(1.5, 3.5, 6)
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x3a6b2a, flatShading: true, roughness: 0.8 })

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count)
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, count)
    trunks.castShadow = true
    crowns.castShadow = true

    const dummy = new THREE.Matrix4()
    let placed = 0

    for (let attempt = 0; attempt < count * 3 && placed < count; attempt++) {
      const x = (Math.random() - 0.5) * WORLD_SIZE * 0.9
      const z = (Math.random() - 0.5) * WORLD_SIZE * 0.9
      if (this._isExcluded(x, z)) continue

      const density = this.noise(x * 0.01, z * 0.01)
      if (density < -0.2) continue

      const y = this.terrain.getHeightAt(x, z)
      const scale = 0.7 + Math.random() * 0.8

      dummy.makeRotationY(Math.random() * Math.PI * 2)
      dummy.scale(new THREE.Vector3(scale, scale, scale))
      dummy.setPosition(x, y + 1.0 * scale, z)
      trunks.setMatrixAt(placed, dummy)

      dummy.setPosition(x, y + 2.8 * scale, z)
      crowns.setMatrixAt(placed, dummy)
      placed++
    }

    trunks.count = placed
    crowns.count = placed
    trunks.instanceMatrix.needsUpdate = true
    crowns.instanceMatrix.needsUpdate = true
    this.scene.add(trunks)
    this.scene.add(crowns)
  }
}
