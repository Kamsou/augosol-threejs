import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

export default class Renderer {
  constructor(experience) {
    this.experience = experience
    this.canvas = experience.canvas
    this.sizes = experience.sizes
    this.scene = experience.scene
    this.camera = experience.camera

    this.instance = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !isMobile,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.instance.setSize(this.sizes.width, this.sizes.height)
    this.instance.setPixelRatio(Math.min(this.sizes.pixelRatio, isMobile ? 1.5 : 2))
    this.instance.shadowMap.enabled = true
    this.instance.shadowMap.type = isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap
    this.instance.toneMapping = THREE.ACESFilmicToneMapping
    this.instance.toneMappingExposure = 1.2
    this.instance.outputColorSpace = THREE.SRGBColorSpace

    this.composer = new EffectComposer(this.instance)
    this.composer.addPass(new RenderPass(this.scene, this.camera.instance))

    if (!isMobile) {
      const bloomRes = new THREE.Vector2(this.sizes.width, this.sizes.height)
      this.bloomPass = new UnrealBloomPass(bloomRes, 0.25, 0.8, 0.85)
      this.composer.addPass(this.bloomPass)
    }

    this.vignettePass = new ShaderPass(VignetteShader)
    this.vignettePass.uniforms['offset'].value = 1.0
    this.vignettePass.uniforms['darkness'].value = 1.2
    this.composer.addPass(this.vignettePass)

    this.composer.addPass(new OutputPass())

    this.sizes.on('resize', () => this.resize())
  }

  resize() {
    this.instance.setSize(this.sizes.width, this.sizes.height)
    this.instance.setPixelRatio(Math.min(this.sizes.pixelRatio, isMobile ? 1.5 : 2))
    this.composer.setSize(this.sizes.width, this.sizes.height)
    this.composer.setPixelRatio(Math.min(this.sizes.pixelRatio, isMobile ? 1.5 : 2))
  }

  update() {
    this.composer.render()
  }
}
