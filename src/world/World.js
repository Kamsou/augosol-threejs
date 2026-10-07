import * as THREE from 'three'
import AssetManager from '../core/AssetManager.js'
import Terrain from './Terrain.js'
import Sky from './Sky.js'
import Lighting from './Lighting.js'
import Vegetation from './Vegetation.js'
import Particles from './Particles.js'
import DustSystem from './DustSystem.js'
import PathSystem from './PathSystem.js'
import Grass from './Grass.js'
import Collectibles from './Collectibles.js'
import LightPool from './LightPool.js'
import Herd from './Herd.js'
import JumpCourse from './JumpCourse.js'
import { updateWind } from './Wind.js'
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

    // Load terrain textures
    this.terrainTextures = await this.assetManager.loadTerrainTextures(
      this.experience.renderer.instance,
      (data) => {
        onProgress?.({
          progress: 0.35 + data.progress * 0.03,
          loaded: data.loaded,
          total: data.total
        })
      }
    )
    onProgress?.(0.38)

    this.lighting = new Lighting(this.scene)
    this.terrain = new Terrain(this.scene, this.terrainTextures)
    this.sky = new Sky(this.scene)
    onProgress?.(0.45)

    this.vegetation = new Vegetation(this.scene, this.terrain, this.assetManager)
    this.particles = new Particles(this.scene)
    this.dustSystem = new DustSystem(this.scene)
    this.pathSystem = new PathSystem(this.scene, this.terrain)
    this.grass = new Grass(this.scene, this.terrain)
    this.collectibles = new Collectibles(this.scene, this.terrain, this.pathSystem)
    this.course = new JumpCourse(this.scene, this.terrain)
    onProgress?.(0.55)

    this._generateEnvMap()
    onProgress?.(0.65)

    this.horse = new Horse(this.scene, this.experience.inputManager, this.terrain)
    await this.horse.load()
    onProgress?.(0.85)

    this.locationManager = new LocationManager(this.scene, this.terrain, this.assetManager)
    this.lightPool = new LightPool(this.scene, 4)
    this.lightPool.adopt(this.scene)
    this.herd = new Herd(this.scene, this.terrain, this.horse)
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

  // Runs every frame, even behind the welcome screen: wind, sky, grass, pollen
  updateAmbient(dt) {
    if (!this.ready) return
    const camera = this.experience.camera.instance
    const horsePosition = this.horse.mesh.position

    updateWind(dt)
    this.sky.update(camera.position)
    this.vegetation.update(camera, horsePosition)
    this.grass.update(horsePosition)
    this.particles.update(dt, horsePosition, this.experience.renderer.instance.getPixelRatio())
  }

  update(dt) {
    if (!this.ready) return

    const horsePosition = this.horse.mesh.position
    this.horse.update(dt)
    this.herd.update(dt, horsePosition)
    this.herd.collide(horsePosition, this.horse.controller.currentRotation)
    this.lighting.update(dt, horsePosition)
    this.lightPool.update(dt, horsePosition)
    this.locationManager.update(dt, horsePosition)
    this.collectibles.update(dt, horsePosition)
    this.course.update(dt, this.horse)
    this.dustSystem.update(dt, horsePosition, this.horse.controller.speed)
  }
}
