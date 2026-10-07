import * as THREE from 'three'
import { createNoise2D } from 'simplex-noise'
import { WORLD_SIZE, PENSIONS, COURSE } from '../utils/Constants.js'
import { WIND, WIND_GLSL } from './Wind.js'

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
const CULL_EVERY = 2
const SHADOW_KEEP_RADIUS = 45

const _frustum = new THREE.Frustum()
const _projScreen = new THREE.Matrix4()
const _sphere = new THREE.Sphere()

export default class Vegetation {
  constructor(scene, terrain, assetManager) {
    this.scene = scene
    this.terrain = terrain
    this.assets = assetManager
    this.noise = createNoise2D()
    this._sets = []
    this._frame = 0
    this._cullCamera = new THREE.PerspectiveCamera()

    this._createTrees()
    this._createBushes()
    this._createRocks()
    if (!isMobile) this._createGrass()
    this._createFlowers()
  }

  // The spawn clearing is wide enough for the welcome camera to circle the horse unobstructed
  _isExcluded(x, z, spawnRadius = 22, pensionRadius = 18) {
    if (Math.sqrt(x * x + z * z) < spawnRadius) return true
    if (Math.hypot(x - COURSE.center.x, z - COURSE.center.z) < COURSE.clearRadius) return true
    for (const key of Object.keys(PENSIONS)) {
      const pos = PENSIONS[key].position
      if (Math.sqrt((x - pos.x) ** 2 + (z - pos.z) ** 2) < pensionRadius) return true
    }
    return false
  }

  // Sway instanced vegetation in the shared wind (amount grows with height above the root)
  _applyWind(material, sway) {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, WIND)
      shader.uniforms.uSway = { value: sway }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          ${WIND_GLSL}
          uniform float uSway;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          #ifdef USE_INSTANCING
            vec3 instPos = instanceMatrix[3].xyz;
            float phase = instPos.x * 0.13 + instPos.z * 0.11;
            float swayK = pow(max(transformed.y, 0.0), 1.5) * uSway;
            vec2 sway = uWindDir * (windGust(instPos.xz) * 0.8 + 0.2) * uWindStrength
              + vec2(sin(uTime * 1.3 + phase), cos(uTime * 1.1 + phase * 1.3)) * 0.25;
            // Bring the world-space sway into the instance's rotated/scaled frame
            mat3 instRS = mat3(instanceMatrix);
            float instScale2 = dot(instRS[0], instRS[0]);
            vec3 localSway = transpose(instRS) * vec3(sway.x, 0.0, sway.y) / instScale2;
            transformed.xz += localSway.xz * swayK;
            transformed.xz += vec2(sin(uTime * 5.0 + transformed.y * 2.0 + phase), cos(uTime * 4.3 + transformed.x * 2.0)) * 0.015 * swayK;
          #endif`)
    }
    material.customProgramCacheKey = () => 'vegetation-wind'
  }

  // Instances are culled on the CPU (frustum + distance) and only the survivors are uploaded,
  // so far-away and off-screen vegetation costs nothing in the main and shadow passes
  _placeInstanced(assetName, count, placeFn, { sway = 0, maxDistance = Infinity, castShadow = !isMobile } = {}) {
    const parts = this.assets.getInstanceParts(assetName)
    if (!parts) return null

    if (sway > 0) {
      for (const part of parts) this._applyWind(part.material, sway)
    }

    const bounds = new THREE.Sphere()
    for (const part of parts) {
      part.geometry.computeBoundingSphere()
      if (bounds.isEmpty()) bounds.copy(part.geometry.boundingSphere)
      else bounds.union(part.geometry.boundingSphere)
    }

    const dummy = new THREE.Matrix4()
    const _scaleVec = new THREE.Vector3()
    const meshes = parts.map(part => {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, count)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      mesh.castShadow = castShadow
      mesh.receiveShadow = true
      return mesh
    })

    const matrices = new Float32Array(count * 16)
    const spheres = new Float32Array(count * 4)
    let placed = 0
    for (let attempt = 0; attempt < count * 4 && placed < count; attempt++) {
      const result = placeFn(attempt)
      if (!result) continue

      const { x, z, scale, rotation } = result
      const y = this.terrain.getHeightAt(x, z)

      dummy.makeRotationY(rotation)
      dummy.scale(_scaleVec.set(scale, scale, scale))
      dummy.setPosition(x, y, z)
      dummy.toArray(matrices, placed * 16)

      spheres[placed * 4] = x + bounds.center.x * scale
      spheres[placed * 4 + 1] = y + bounds.center.y * scale
      spheres[placed * 4 + 2] = z + bounds.center.z * scale
      spheres[placed * 4 + 3] = bounds.radius * scale
      placed++
    }

    for (const mesh of meshes) {
      mesh.count = 0
      this.scene.add(mesh)
    }

    this._sets.push({ meshes, matrices, spheres, total: placed, maxDistance, castShadow })
    return meshes
  }

  update(camera, focus) {
    if (this._frame++ % CULL_EVERY !== 0) return

    // Slightly wider than the real view so quick turns between two culls never show holes
    const cull = this._cullCamera
    cull.copy(camera, false)
    cull.fov = Math.min(camera.fov + 20, 120)
    cull.updateProjectionMatrix()
    cull.updateMatrixWorld(true)
    _projScreen.multiplyMatrices(cull.projectionMatrix, cull.matrixWorldInverse)
    _frustum.setFromProjectionMatrix(_projScreen)

    for (const set of this._sets) {
      const { matrices, spheres, total, maxDistance, castShadow } = set
      const firstArray = set.meshes[0].instanceMatrix.array
      const maxDistSq = maxDistance * maxDistance
      let visible = 0

      for (let i = 0; i < total; i++) {
        const cx = spheres[i * 4]
        const cy = spheres[i * 4 + 1]
        const cz = spheres[i * 4 + 2]
        const dx = cx - focus.x
        const dz = cz - focus.z
        const distSq = dx * dx + dz * dz
        if (distSq > maxDistSq) continue

        _sphere.center.set(cx, cy, cz)
        _sphere.radius = spheres[i * 4 + 3]
        // Nearby casters stay even off-screen: their shadows can still fall into view
        const shadowKeep = castShadow && distSq < SHADOW_KEEP_RADIUS * SHADOW_KEEP_RADIUS
        if (!shadowKeep && !_frustum.intersectsSphere(_sphere)) continue

        firstArray.set(matrices.subarray(i * 16, i * 16 + 16), visible * 16)
        visible++
      }

      for (const mesh of set.meshes) {
        if (mesh.instanceMatrix.array !== firstArray) {
          mesh.instanceMatrix.array.set(firstArray.subarray(0, visible * 16))
        }
        mesh.count = visible
        mesh.instanceMatrix.clearUpdateRanges()
        mesh.instanceMatrix.addUpdateRange(0, visible * 16)
        mesh.instanceMatrix.needsUpdate = true
      }
    }
  }

  _createTrees() {
    const treeTypes = ['tree_pine', 'tree_oak', 'tree_birch']
    const countPerType = isMobile ? 60 : 150

    for (const type of treeTypes) {
      if (!this.assets.has(type)) {
        this._createFallbackTrees(countPerType * treeTypes.length)
        return
      }
    }

    for (const type of treeTypes) {
      this._placeInstanced(type, countPerType, () => {
        const x = (Math.random() - 0.5) * WORLD_SIZE * 0.95
        const z = (Math.random() - 0.5) * WORLD_SIZE * 0.95
        if (this._isExcluded(x, z)) return null

        const density = this.noise(x * 0.01, z * 0.01)
        if (density < -0.5) return null

        return {
          x, z,
          scale: 0.7 + Math.random() * 0.7,
          rotation: Math.random() * Math.PI * 2,
        }
      }, { sway: 0.006 })
    }

    if (this.assets.has('dead_tree')) {
      this._placeInstanced('dead_tree', isMobile ? 15 : 40, () => {
        const x = (Math.random() - 0.5) * WORLD_SIZE * 0.95
        const z = (Math.random() - 0.5) * WORLD_SIZE * 0.95
        if (this._isExcluded(x, z)) return null

        const density = this.noise(x * 0.015 + 100, z * 0.015 + 100)
        if (density > 0.1) return null

        return {
          x, z,
          scale: 0.6 + Math.random() * 0.6,
          rotation: Math.random() * Math.PI * 2,
        }
      }, { sway: 0.003 })
    }
  }

  _createBushes() {
    const bushTypes = ['bush_1', 'bush_2']
    const countPerType = isMobile ? 15 : 30

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
      }, { sway: 0.03, maxDistance: 190 })
    }
  }

  _createRocks() {
    const rockTypes = ['rock_1', 'rock_2', 'rock_3']
    const countPerType = isMobile ? 8 : 15

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
      }, { maxDistance: 200 })
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
      }, { sway: 0.12, maxDistance: 90, castShadow: false })
    }
  }

  _createFlowers() {
    const flowerTypes = ['flower_1', 'flower_2']
    const countPerType = isMobile ? 30 : 80

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
      }, { sway: 0.15, maxDistance: 110, castShadow: false })
    }

    const flowerGeo = new THREE.SphereGeometry(0.1, 4, 3)
    flowerGeo.translate(0, 0.25, 0)
    const flowerMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.7 })
    const count = isMobile ? 80 : 200
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
    trunks.castShadow = !isMobile
    crowns.castShadow = !isMobile

    const dummy = new THREE.Matrix4()
    const _sv = new THREE.Vector3()
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
      dummy.scale(_sv.set(scale, scale, scale))
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
