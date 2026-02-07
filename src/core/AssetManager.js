import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { ASSET_MANIFEST } from '../utils/Constants.js'

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

export default class AssetManager {
  constructor() {
    this.loader = new GLTFLoader()
    this.assets = new Map()
  }

  async loadAll(onProgress) {
    const entries = Object.entries(ASSET_MANIFEST)
    let loaded = 0

    const promises = entries.map(([name, config]) => {
      return this.loader.loadAsync(config.path).then(gltf => {
        const scene = gltf.scene

        scene.traverse(child => {
          if (child.isMesh) {
            child.castShadow = !isMobile
            child.receiveShadow = true
          }
        })

        scene.updateMatrixWorld(true)

        this.assets.set(name, {
          scene,
          scale: config.scale || 1,
          yOffset: config.yOffset || 0,
        })

        loaded++
        onProgress?.(loaded / entries.length)
      }).catch(err => {
        console.warn(`AssetManager: failed to load "${name}" from ${config.path}`, err)
        loaded++
        onProgress?.(loaded / entries.length)
      })
    })

    await Promise.all(promises)
  }

  has(name) {
    return this.assets.has(name)
  }

  getSceneClone(name) {
    const asset = this.assets.get(name)
    if (!asset) return null

    const clone = asset.scene.clone(true)
    clone.scale.setScalar(asset.scale)
    clone.position.y = asset.yOffset

    clone.traverse(child => {
      if (child.isMesh) {
        child.castShadow = !isMobile
        child.receiveShadow = true
        if (Array.isArray(child.material)) {
          child.material = child.material.map(m => m.clone())
        } else {
          child.material = child.material.clone()
        }
      }
    })

    return clone
  }

  getInstanceParts(name) {
    const asset = this.assets.get(name)
    if (!asset) return null

    const parts = []
    const sceneInverse = new THREE.Matrix4().copy(asset.scene.matrixWorld).invert()

    asset.scene.traverse(child => {
      if (child.isMesh) {
        const geo = child.geometry.clone()

        const relMatrix = new THREE.Matrix4()
          .copy(sceneInverse)
          .multiply(child.matrixWorld)
        geo.applyMatrix4(relMatrix)

        geo.scale(asset.scale, asset.scale, asset.scale)
        geo.translate(0, asset.yOffset, 0)

        parts.push({
          geometry: geo,
          material: child.material.clone(),
        })
      }
    })

    return parts.length ? parts : null
  }
}
