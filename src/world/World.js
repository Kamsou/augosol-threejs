import * as THREE from 'three'
import AssetManager from '../core/AssetManager.js'
import Terrain from './Terrain.js'
import Sky from './Sky.js'
import Lighting from './Lighting.js'
import Vegetation from './Vegetation.js'
import Particles from './Particles.js'
import DustSystem from './DustSystem.js'
import PathSystem from './PathSystem.js'
import Horse from '../entities/Horse.js'
import LocationManager from '../locations/LocationManager.js'

export default class World {
  constructor(experience) {
    this.experience = experience
    this.scene = experience.scene
    this.ready = false
  }

  async init(onProgress) {
    this.assetManager = new AssetManager(this.experience.renderer.instance)
    await this.assetManager.loadAll((data) => {
      onProgress?.({
        progress: data.progress * 0.35,
        loaded: data.loaded,
        total: data.total
      })
    })

    onProgress?.(0.35)
    this.lighting = new Lighting(this.scene)
    this.terrain = new Terrain(this.scene)
    this.sky = new Sky(this.scene)
    onProgress?.(0.45)

    this.vegetation = new Vegetation(this.scene, this.terrain, this.assetManager)
    this.particles = new Particles(this.scene)
    this.dustSystem = new DustSystem(this.scene)
    this.pathSystem = new PathSystem(this.scene, this.terrain)
    onProgress?.(0.55)

    this._generateEnvMap()
    onProgress?.(0.65)

    this.horse = new Horse(this.scene, this.experience.inputManager, this.terrain)
    await this.horse.load()
    onProgress?.(0.85)

    this.locationManager = new LocationManager(this.scene, this.terrain, this.assetManager)
    onProgress?.(0.95)

    this.experience.camera.setTarget(this.horse.mesh)

    this.ready = true
    onProgress?.(1.0)
  }

  _generateEnvMap() {
    const pmremGenerator = new THREE.PMREMGenerator(this.experience.renderer.instance)
    pmremGenerator.compileEquirectangularShader()
    const envRT = pmremGenerator.fromScene(this.scene, 0, 0.1, 1000)
    this.scene.environment = envRT.texture
    pmremGenerator.dispose()
  }

  update(dt) {
    if (!this.ready) return

    this.horse.update(dt)
    this.lighting.update(dt, this.horse.mesh.position)
    this.locationManager.update(dt, this.horse.mesh.position)
    this.particles.update(dt)
    this.dustSystem.update(dt, this.horse.mesh.position, this.horse.controller.speed)
  }
}
