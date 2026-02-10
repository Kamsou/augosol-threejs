import * as THREE from 'three'
import Sizes from './core/Sizes.js'
import Time from './core/Time.js'
import Camera from './core/Camera.js'
import Renderer from './core/Renderer.js'
import InputManager from './core/InputManager.js'
import World from './world/World.js'
import LoadingScreen from './ui/LoadingScreen.js'
import WelcomeScreen from './ui/WelcomeScreen.js'
import HUD from './ui/HUD.js'
import InteractionPrompt from './ui/InteractionPrompt.js'
import LocationInfoPanel from './ui/LocationInfoPanel.js'
import QuestBanner from './ui/QuestBanner.js'
import { PENSIONS, HORSE } from './utils/Constants.js'

export default class Experience {
  static instance = null

  constructor(canvas) {
    if (Experience.instance) return Experience.instance
    Experience.instance = this

    this.canvas = canvas
    this.started = false

    this.sizes = new Sizes()
    this.time = new Time()
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0xe5d0b5)
    this.inputManager = new InputManager()
    this.camera = new Camera(this)
    this.renderer = new Renderer(this)

    this.loadingScreen = new LoadingScreen()
    this.welcomeScreen = new WelcomeScreen()
    this.hud = new HUD()
    this.interactionPrompt = new InteractionPrompt()
    this.locationInfoPanel = new LocationInfoPanel()
    this.questBanner = new QuestBanner()

    this.questState = 'none'
    this._lastViewedLocation = null

    this.time.on('tick', () => this._update())
    this._init()
  }

  async _init() {
    try {
      const loadStart = Date.now()
      const MIN_LOADING_TIME = 3000

      this.world = new World(this)
      await this.world.init((data) => {
        if (typeof data === 'object' && data.loaded !== undefined) {
          this.loadingScreen.setProgress(data.progress * 0.8)
          this.loadingScreen.setCounter(data.loaded, data.total)
        } else {
          this.loadingScreen.setProgress(data * 0.8)
        }
      })

      this._setupInteractions()

      const elapsed = Date.now() - loadStart
      const remaining = Math.max(MIN_LOADING_TIME - elapsed, 800)
      await this._smoothProgress(0.8, 1.0, remaining)

      await this.loadingScreen.hide()
      this.welcomeScreen.show()

      this.welcomeScreen.onStart(() => {
        this.started = true
        this.hud.show()
        if (this.inputManager.isMobile) {
          document.getElementById('touch-controls')?.classList.remove('hidden')
        }
        this._startQuest1()
      })

    } catch (error) {
      console.error('Experience init failed:', error)
      this.loadingScreen.hide()
    }
  }

  _startQuest1() {
    this.questState = 'quest1'
    this.questBanner.show('Rendez-vous au Domaine de l\'Image', 'Étape 1')
  }

  _startQuest2() {
    this.questState = 'quest2'
    this.questBanner.show('Trouvez une pension qui respecte votre cheval', 'Étape 2')
  }

  _completeQuests() {
    this.questState = 'complete'
    this.questBanner.hide()
  }

  _setupInteractions() {
    const locationManager = this.world.locationManager

    locationManager.on('approach', (info) => {
      if (this.locationInfoPanel.isVisible) return
      this.interactionPrompt.show(info.location.name)
      this.camera.setApproachMode(true)
    })

    locationManager.on('leave', () => {
      this.interactionPrompt.hide()
      this.camera.setApproachMode(false)
    })

    const doInteract = () => {
      if (!this.started) return

      if (this.locationInfoPanel.isVisible) {
        this.locationInfoPanel.hide()
        this.camera.stopCinematic()
        this.camera.setApproachMode(false)
        this.world.horse.controller.frozen = false
        return
      }

      if (this.camera.isCinematicActive) return

      if (locationManager.isInRange && locationManager.nearestLocation) {
        const { key } = locationManager.nearestLocation
        const config = PENSIONS[key]
        this.interactionPrompt.hide()
        this._lastViewedLocation = key

        this.world.horse.controller.speed = 0
        this.world.horse.controller.frozen = true

        this.camera.playCinematic(() => {
          this.locationInfoPanel.show(key, config)
        })
      }
    }

    this.inputManager.on('interact', (pressed) => {
      if (!pressed) return
      doInteract()
    })

    this.interactionPrompt.onTap(() => doInteract())

    this.locationInfoPanel.onChoose((locationData) => {
      this.camera.stopCinematic()
      this.world.horse.controller.frozen = false
      this._celebrate(locationData.config)
    })

    this.locationInfoPanel.onContinue(() => {
      this.camera.stopCinematic()
      this.camera.setApproachMode(false)
      this.world.horse.controller.frozen = false

      if (this.questState === 'quest1' && this._lastViewedLocation === 'showpiece') {
        this._startQuest2()
      }
    })
  }

  _celebrate(config) {
    this.locationInfoPanel.hide()
    this.hud.hide()
    this.questBanner.hide()
    this.interactionPrompt.hide()
    document.getElementById('touch-controls')?.classList.add('hidden')
    const celebrationScreen = document.getElementById('celebration-screen')
    const title = document.getElementById('celebration-title')
    const text = document.getElementById('celebration-text')
    const restartBtn = document.getElementById('btn-restart')
    const btnText = restartBtn?.querySelector('.btn-text')
    const glow = document.getElementById('celebration-glow')
    const icon = document.getElementById('celebration-icon')
    const footer = document.getElementById('celebration-footer')

    const NS = 'http://www.w3.org/2000/svg'
    const makeSvg = (pathD) => {
      const svg = document.createElementNS(NS, 'svg')
      svg.setAttribute('viewBox', '0 0 24 24')
      svg.setAttribute('fill', 'none')
      svg.setAttribute('stroke', 'currentColor')
      svg.setAttribute('stroke-width', '2')
      svg.setAttribute('stroke-linecap', 'round')
      svg.setAttribute('stroke-linejoin', 'round')
      const path = document.createElementNS(NS, 'path')
      path.setAttribute('d', pathD)
      svg.appendChild(path)
      return svg
    }

    const setIcon = (iconEl, pathD, color) => {
      iconEl.replaceChildren(makeSvg(pathD))
      iconEl.style.background = color.replace('1)', '0.12)')
      iconEl.style.color = color.replace('0.12)', '1)')
      iconEl.style.border = `1px solid ${color.replace('0.12)', '0.25)')}`
    }

    const checkPath = 'M20 6L9 17l-5-5'
    const warnPath = 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'
    const greenColor = 'rgba(34, 197, 94, 0.12)'
    const amberColor = 'rgba(245, 158, 11, 0.12)'

    if (this.questState === 'quest2' && config.ethical) {
      this._completeQuests()
      if (title) { title.textContent = 'Bravo !'; title.className = 'ethical-result' }
      if (text) text.textContent = `Vous avez choisi ${config.name}, un lieu où le bien-être du cheval passe avant tout. Vie sociale, liberté de mouvement et soins adaptés : votre cheval peut s'épanouir pleinement.`
      if (btnText) btnText.textContent = 'Rejouer'
      if (glow) glow.style.background = 'radial-gradient(circle, rgba(34, 197, 94, 0.1) 0%, transparent 70%)'
      if (icon) setIcon(icon, checkPath, greenColor)
      if (footer) footer.textContent = 'Quête terminée. Merci d\'avoir joué'
    } else if (config.ethical) {
      if (title) { title.textContent = 'Bon choix !'; title.className = 'ethical-result' }
      if (text) text.textContent = `${config.name} respecte les besoins fondamentaux de votre cheval. Mais ce n'est pas la pension que vous cherchiez — continuez l'exploration pour accomplir votre quête.`
      if (btnText) btnText.textContent = 'Continuer'
      if (glow) glow.style.background = 'radial-gradient(circle, rgba(34, 197, 94, 0.08) 0%, transparent 70%)'
      if (icon) setIcon(icon, checkPath, greenColor)
      if (footer) footer.textContent = 'Continuez à explorer le domaine'
    } else {
      if (title) { title.textContent = 'Attention'; title.className = 'unethical-result' }
      if (text) text.textContent = `${config.name} ne garantit pas le bien-être de votre cheval. ${config.description} D'autres pensions sauront mieux le respecter.`
      if (btnText) btnText.textContent = 'Continuer la recherche'
      if (glow) glow.style.background = 'radial-gradient(circle, rgba(245, 158, 11, 0.1) 0%, transparent 70%)'
      if (icon) setIcon(icon, warnPath, amberColor)
      if (footer) footer.textContent = 'Votre cheval mérite mieux'
    }

    celebrationScreen?.classList.add('hidden')
    void celebrationScreen?.offsetWidth
    celebrationScreen?.classList.remove('hidden')

    const savedQuestState = this.questState

    restartBtn?.addEventListener('click', () => {
      celebrationScreen?.classList.add('hidden')
      this.hud.show()
      this.camera.setApproachMode(false)
      if (this.inputManager.isMobile) {
        document.getElementById('touch-controls')?.classList.remove('hidden')
      }

      this.world.horse.mesh.position.set(0, 0, 0)
      this.world.horse.controller.currentRotation = 0
      this.world.horse.controller.speed = 0

      if (savedQuestState === 'quest1') {
        if (this._lastViewedLocation === 'showpiece') {
          this._startQuest2()
        } else {
          this._startQuest1()
        }
      } else if (savedQuestState === 'quest2' && !config.ethical) {
        this._startQuest2()
      } else {
        this._startQuest1()
      }
    }, { once: true })
  }

  _update() {
    const dt = this.time.deltaSeconds

    if (this.started && this.world?.ready) {
      this.world.update(dt)

      const horsePosition = this.world.horse.mesh.position
      const horseRotation = this.world.horse.controller.currentRotation
      const movementState = this.world.horse.controller.movementState
      const locationWorldData = this.world.locationManager.getLocationsWorldData()

      let questHint = null
      if (this.questState === 'quest1') {
        questHint = { targetKey: 'showpiece' }
      } else if (this.questState === 'quest2') {
        questHint = { targetEthical: true }
      }

      this.hud.update(horsePosition, horseRotation, movementState, locationWorldData, questHint)

      const speed = Math.abs(this.world.horse.controller.speed)
      this.camera.setSpeedRatio(speed / HORSE.gallopSpeed)
    }

    this.camera.update(dt)
    this.renderer.update()
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  _smoothProgress(from, to, duration) {
    return new Promise(resolve => {
      const start = Date.now()
      const step = () => {
        const t = Math.min((Date.now() - start) / duration, 1)
        const eased = 1 - Math.pow(1 - t, 3)
        this.loadingScreen.setProgress(from + (to - from) * eased)
        if (t < 1) {
          requestAnimationFrame(step)
        } else {
          resolve()
        }
      }
      requestAnimationFrame(step)
    })
  }
}
