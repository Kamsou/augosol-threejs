import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js'
import { FinalShader } from './FinalShader.js'

const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

// Dynamic resolution: trade pixels for frame rate when the GPU struggles
const SLOW_FRAME = 1 / 50
const FAST_FRAME = 1 / 58
const PIXEL_RATIO_STEP = 0.25
const WARMUP = 3

export default class Renderer {
  constructor(experience) {
    this.experience = experience
    this.canvas = experience.canvas
    this.sizes = experience.sizes
    this.scene = experience.scene
    this.camera = experience.camera

    this.speedRatio = 0
    this.photoFilter = 0
    this.dof = 0
    this.mood = 0
    this._smoothSpeed = 0
    this._elapsed = 0

    this._maxPixelRatio = Math.min(this.sizes.pixelRatio, isMobile ? 1 : 2)
    this._minPixelRatio = isMobile ? 0.75 : 1
    this.pixelRatio = this._maxPixelRatio
    this._ceiling = this._maxPixelRatio
    this._runTime = 0
    this._sampleTime = 0
    this._sampleFrames = 0
    this._slowSamples = 0
    this._fastSamples = 0

    this.instance = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: !isMobile,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    })
    this.instance.setSize(this.sizes.width, this.sizes.height)
    this.instance.setPixelRatio(this.pixelRatio)
    this.instance.shadowMap.enabled = true
    this.instance.shadowMap.type = isMobile ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap

    this.instance.toneMapping = THREE.ACESFilmicToneMapping
    this.instance.toneMappingExposure = 1.2
    this.instance.outputColorSpace = THREE.SRGBColorSpace

    if (!isMobile) {
      this.composer = new EffectComposer(this.instance)
      this.composer.addPass(new RenderPass(this.scene, this.camera.instance))

      const bloomRes = new THREE.Vector2(this.sizes.width, this.sizes.height)
      this.bloomPass = new UnrealBloomPass(bloomRes, 0.2, 0.6, 0.95)
      this.composer.addPass(this.bloomPass)

      this.composer.addPass(new OutputPass())

      // The composer bypasses the canvas MSAA; SMAA keeps the thin grass blades from shimmering
      this.smaaPass = new SMAAPass()
      this.composer.addPass(this.smaaPass)

      this.finalPass = new ShaderPass(FinalShader)
      this.composer.addPass(this.finalPass)
      this._updateResolution()
    }

    this.sizes.on('resize', () => this.resize())
  }

  get supportsEffects() {
    return !!this.composer
  }

  _updateResolution() {
    // At high pixel density the extra pixels already smooth edges; SMAA is wasted work
    if (this.smaaPass) this.smaaPass.enabled = this.pixelRatio < 1.5
    if (!this.finalPass) return
    this.finalPass.uniforms.uResolution.value.set(this.sizes.width * this.pixelRatio, this.sizes.height * this.pixelRatio)
  }

  _applyPixelRatio() {
    this.instance.setPixelRatio(this.pixelRatio)
    if (this.composer) this.composer.setPixelRatio(this.pixelRatio)
    this._updateResolution()
  }

  // Average the frame time over one second and step the resolution down (or back up)
  _adaptResolution(dt) {
    // Loading hitches and first shader compiles are not representative
    if (!this.experience.started) return
    this._runTime += dt
    if (this._runTime < WARMUP) return
    this._sampleTime += dt
    this._sampleFrames++
    if (this._sampleTime < 1) return

    const avg = this._sampleTime / this._sampleFrames
    this._sampleTime = 0
    this._sampleFrames = 0

    // After a step down, check it actually helped. If frames are just as slow, the limit is
    // not the GPU (e.g. a 30 Hz cap in iOS Low Power Mode): undo it and stop adapting.
    if (this._probe) {
      const { from, before } = this._probe
      this._probe = null
      if (avg > before * 0.9) {
        this.pixelRatio = from
        this._ceiling = from
        this._adaptDisabled = true
        this._applyPixelRatio()
        return
      }
    }
    if (this._adaptDisabled) return

    this._slowSamples = avg > SLOW_FRAME ? this._slowSamples + 1 : 0
    this._fastSamples = avg < FAST_FRAME ? this._fastSamples + 1 : 0

    if (this._slowSamples >= 2 && this.pixelRatio > this._minPixelRatio) {
      // A level that was too slow is not retried, so we never ping-pong
      this._probe = { from: this.pixelRatio, before: avg }
      this._ceiling = this.pixelRatio - PIXEL_RATIO_STEP
      this.pixelRatio = Math.max(this._minPixelRatio, this.pixelRatio - PIXEL_RATIO_STEP)
      this._slowSamples = 0
      this._applyPixelRatio()
    } else if (this._fastSamples >= 5 && this.pixelRatio < Math.min(this._ceiling, this._maxPixelRatio)) {
      this.pixelRatio = Math.min(this._ceiling, this.pixelRatio + PIXEL_RATIO_STEP)
      this._fastSamples = 0
      this._applyPixelRatio()
    }
  }

  resize() {
    this._maxPixelRatio = Math.min(this.sizes.pixelRatio, isMobile ? 1 : 2)
    this.pixelRatio = Math.min(this.pixelRatio, this._maxPixelRatio)
    this.instance.setSize(this.sizes.width, this.sizes.height)
    if (this.composer) this.composer.setSize(this.sizes.width, this.sizes.height)
    this._applyPixelRatio()
  }

  update(dt = 0.016) {
    this._elapsed += dt
    if (dt > 0) this._adaptResolution(dt)

    if (this.composer) {
      this._smoothSpeed += (this.speedRatio - this._smoothSpeed) * Math.min(dt * 3, 1)
      const u = this.finalPass.uniforms
      u.uTime.value = this._elapsed
      // Speed effects only kick in once the horse really gallops
      u.uSpeed.value = THREE.MathUtils.smoothstep(this._smoothSpeed, 0.45, 1.0)
      u.uFilter.value = this.photoFilter
      u.uMood.value = this.mood
      u.uDof.value += (this.dof - u.uDof.value) * Math.min(dt * 4, 1)
      this.composer.render()
    } else {
      this.instance.render(this.scene, this.camera.instance)
    }
  }
}
