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
import Toast from './ui/Toast.js'
import PhotoMode from './ui/PhotoMode.js'
import AudioManager from './core/AudioManager.js'
import Profile from './core/Profile.js'
import HorseEmotes from './ui/HorseEmotes.js'
import PensionMood from './world/PensionMood.js'
import CourseHUD from './ui/CourseHUD.js'
import { formatTime } from './world/JumpCourse.js'
import { PENSIONS, HORSE, COURSE, JUMP } from './utils/Constants.js'

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
    this.toast = new Toast()
    this.profile = new Profile()
    this.audio = new AudioManager()
    this.photoMode = new PhotoMode(this)
    this.emotes = new HorseEmotes(this)
    this._ray = new THREE.Raycaster()
    this._pointer = new THREE.Vector2()
    this._horseCenter = new THREE.Vector3()

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
          this.loadingScreen.setCounter()
        } else {
          this.loadingScreen.setProgress(data * 0.8)
          this.loadingScreen.setCounter()
        }
      })

      this._setupInteractions()

      const elapsed = Date.now() - loadStart
      const remaining = Math.max(MIN_LOADING_TIME - elapsed, 800)
      await this._smoothProgress(0.8, 1.0, remaining)

      // The living world is the welcome backdrop: horse idling, camera circling it
      this.world.horse.controller.frozen = true
      this.camera.enterIntro(this.inputManager.isMobile
        ? { lift: -1.9, distance: 12, pitch: 0.16 }
        : { lateral: 2.6, lift: -1.9, distance: 11.5, pitch: 0.1 })

      // Name and coat are picked on the live horse
      this.welcomeScreen.onCoat((coat, fromUser) => {
        this.world.horse.setCoat(coat.body, coat.mane, !fromUser)
        if (fromUser) this.world.horse.react('content')
      })
      this.welcomeScreen.bind(this.profile)

      await this.loadingScreen.hide()
      this.welcomeScreen.show()

      this.welcomeScreen.onStart(() => {
        // Glide from the intro orbit down to the riding camera
        this.camera.exitPhotoMode()
        this.world.horse.controller.frozen = false
        this.started = true
        this.audio.init()
        this.hud.show()
        if (this.inputManager.isMobile) {
          document.getElementById('touch-controls')?.classList.remove('hidden')
        }
        this._startQuest1()
        setTimeout(() => {
          if (!this.photoMode.active) {
            this.toast.show('Des fers d\'or sont cachés dans le domaine', this.inputManager.isMobile
              ? `Touchez ${this.profile.nameInSentence} pour le caresser, « Saut » pour bondir`
              : `Cliquez sur ${this.profile.nameInSentence} pour le caresser · Espace pour sauter · P pour la photo`, { duration: 5500 })
          }
        }, 4500)
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
    this.questBanner.show(`Trouvez une pension qui respecte ${this.profile.nameInSentence}`, 'Étape 2')
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
      // Freezing mid-jump would leave the horse hanging in the air during the cinematic
      if (!this.started || this.photoMode.active || this.world.horse.controller.airborne) return

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

    this._setupPlayground()

    this.locationInfoPanel.onContinue(() => {
      this.camera.stopCinematic()
      this.camera.setApproachMode(false)
      this.world.horse.controller.frozen = false

      if (this.questState === 'quest1' && this._lastViewedLocation === 'showpiece') {
        this._startQuest2()
      }
    })
  }

  // Jump, photo mode, sound and the golden horseshoe hunt
  _setupPlayground() {
    const world = this.world
    const horse = world.horse
    const canPlay = () => this.started && !this.locationInfoPanel.isVisible && !this.camera.isCinematicActive
      && document.getElementById('celebration-screen')?.classList.contains('hidden')

    this.inputManager.on('jump', (pressed) => {
      if (!pressed) return
      if (this.photoMode.active) {
        this.photoMode.capture()
        return
      }
      if (canPlay()) this._requestJump()
    })

    this.inputManager.on('photo', (pressed) => {
      if (!pressed) return
      if (this.photoMode.active) this.photoMode.exit()
      else if (canPlay()) this._enterPhoto()
    })

    this.inputManager.on('escape', (pressed) => {
      if (pressed) this.photoMode.exit()
    })

    this.inputManager.on('mute', (pressed) => {
      if (pressed) this.audio.toggleMute()
    })

    document.getElementById('hud-photo')?.addEventListener('click', () => {
      if (canPlay()) this._enterPhoto()
    })

    const soundBtn = document.getElementById('hud-sound')
    const syncSound = (muted) => soundBtn?.classList.toggle('muted', muted)
    syncSound(this.audio.muted)
    this.audio.onChange(syncSound)
    soundBtn?.addEventListener('click', () => this.audio.toggleMute())

    horse.onTakeoff = (speed) => {
      this.audio.whoosh()
      world.dustSystem.burst(horse.mesh.position, 0.35 + speed / 60)
      this.camera.addFovKick(2 + speed / 10)
    }

    horse.controller.onLand = (impact) => {
      world.dustSystem.burst(horse.mesh.position, impact / 10)
      this.camera.addShake(Math.min(impact / 40, 0.35))
      this.audio.land(impact)
    }

    this.mood = new PensionMood(this)

    this.inputManager.on('pet', (pressed) => {
      if (pressed && canPlay() && !this.photoMode.active) this._petHorse()
    })
    this._setupHorseTouch(canPlay)

    this._setupCourse()

    const collectibles = world.collectibles
    this.hud.setCollectibles(0, collectibles.total)
    collectibles.on(({ collected, total }) => {
      this.audio.chime(collected - 1)
      this.hud.setCollectibles(collected, total)
      if (collected === total) {
        this.audio.fanfare()
        this.toast.show('Collection complète !', `Les ${total} fers d'or sont à vous. Votre cheval vous porte chance`, { variant: 'gold', duration: 5000 })
      } else if (collected === 1) {
        this.toast.show('Premier fer d\'or !', `Encore ${total - 1} à dénicher, suivez les lueurs dorées`, { variant: 'gold' })
      }
    })
  }

  _setupCourse() {
    const course = this.world.course
    this.courseHud = new CourseHUD()
    const plural = (n, word) => `${n} ${word}${n > 1 ? 's' : ''}`

    course.on((e) => {
      switch (e.type) {
        case 'discover':
          this.toast.show('Parcours d\'obstacles', e.best
            ? `Passez sous l'arche pour lancer le chrono · Record ${formatTime(e.best)}`
            : this.inputManager.isMobile
              ? 'Passez sous l\'arche pour lancer le chrono, « Saut » au bon moment'
              : 'Passez sous l\'arche pour lancer le chrono · Espace pour sauter', { duration: 5000 })
          break
        case 'start':
          this.courseHud.show(course.jumps.length)
          this.audio.go()
          this.toast.show('C\'est parti !', `Franchissez les ${course.jumps.length} obstacles dans l'ordre`)
          break
        case 'clear':
          if (e.counts) this.courseHud.mark(e.index - 1, 'clear')
          this.audio.chime(e.counts ? e.index - 1 : 2)
          this.emotes.say('heart', 'Joli saut !', 1300)
          break
        case 'knock': {
          if (e.counts) this.courseHud.mark(e.index - 1, 'knock')
          this.audio.knock()
          const what = e.hind ? 'Touchée des postérieurs' : 'Barre tombée'
          this.emotes.say('alert', e.counts ? `${what} · +${COURSE.penalty} s` : what, 1600)
          break
        }
        case 'incomplete':
          this.toast.show('Pas si vite !', `Encore ${plural(e.remaining, 'obstacle')} avant l'arrivée`)
          break
        case 'finish': {
          this.courseHud.hide()
          this.audio.fanfare()
          const faults = e.faults ? plural(e.faults, 'barre') : 'Sans faute'
          this.toast.show(
            e.record ? `Nouveau record · ${formatTime(e.total)}` : `Parcours terminé · ${formatTime(e.total)}`,
            e.record ? faults : `${faults} · Record ${formatTime(e.best)}`,
            { variant: e.record || !e.faults ? 'gold' : '', duration: 6000 }
          )
          break
        }
        case 'abort':
          this.courseHud.hide()
          this.toast.show('Parcours abandonné', 'Repassez sous l\'arche pour retenter')
          break
      }
    })
  }

  // Jump now, or a touch later if that puts the apex right over the pole ahead
  _requestJump() {
    const horse = this.world.horse
    const controller = horse.controller
    const speed = Math.max(Math.abs(controller.speed), HORSE.trotSpeed)
    const distance = this.world.course.poleAhead(horse.mesh.position, controller.currentRotation)
    let delay = 0
    if (distance !== null && !controller.airborne) {
      // Distance is measured from the centre; the forelegs are ~1.8 ahead and should peak over the pole
      const apex = (speed * controller.airTime) / 2
      const wait = (distance - 1.8 - apex * 0.8) / speed
      if (wait > 0.02 && wait <= JUMP.maxAssistDelay) delay = wait
    }
    horse.requestJump(delay)
  }

  _petHorse() {
    const horse = this.world.horse
    if (!horse.pet()) return
    this.emotes.hearts(4 + Math.floor(Math.random() * 3))
    // Don't spam the voice when clicking repeatedly
    const now = performance.now()
    if (!this._lastNicker || now - this._lastNicker > 1400) {
      this._lastNicker = now
      this.audio.nicker()
    }
  }

  _isOverHorse(clientX, clientY) {
    this._pointer.set((clientX / this.sizes.width) * 2 - 1, -(clientY / this.sizes.height) * 2 + 1)
    this._ray.setFromCamera(this._pointer, this.camera.instance)
    const horse = this.world.horse
    // Cheap capsule-ish test: body centre and head instead of a skinned-mesh raycast
    this._horseCenter.copy(horse.mesh.position).y += 2.6
    if (this._ray.ray.distanceToPoint(this._horseCenter) < 2.3) return true
    horse.getHeadPosition(this._horseCenter)
    return this._ray.ray.distanceToPoint(this._horseCenter) < 1.4
  }

  // Click / tap on the horse to pet it; the cursor turns into a hand on hover
  _setupHorseTouch(canPlay) {
    const canvas = this.canvas
    let down = null

    canvas.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() }
    })

    canvas.addEventListener('pointerup', (e) => {
      if (!down || this.photoMode.active || !canPlay()) return
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y)
      const quick = performance.now() - down.t < 400
      down = null
      if (moved < 10 && quick && this._isOverHorse(e.clientX, e.clientY)) this._petHorse()
    })

    if (!this.inputManager.isMobile) {
      canvas.addEventListener('pointermove', (e) => {
        if (this.photoMode.active || !this.started) return
        const over = canPlay() && this._isOverHorse(e.clientX, e.clientY) && this.world.horse.canBePetted
        canvas.style.cursor = over ? 'pointer' : ''
      })
    }
  }

  _enterPhoto() {
    this.interactionPrompt.hide()
    this.photoMode.enter()
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
      if (text) text.textContent = `Vous avez choisi ${config.name}, un lieu où le bien-être du cheval passe avant tout. Vie sociale, liberté de mouvement et soins adaptés : ${this.profile.nameInSentence} peut s'épanouir pleinement.`
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

      this.world.course?.abort()
      this.world.horse.mesh.position.set(0, 0, 0)
      this.mood?.reset()
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

      const course = this.world.course
      this.hud.update(horsePosition, horseRotation, movementState, locationWorldData, questHint,
        this.world.collectibles.getRemaining(), { gate: course.gatePosition, next: course.nextJumpPosition })
      this.courseHud?.update(course)

      const speed = Math.abs(this.world.horse.controller.speed)
      this.camera.setSpeedRatio(speed / HORSE.gallopSpeed)
      this.renderer.speedRatio = this.photoMode.active ? 0 : speed / HORSE.gallopSpeed
      this.audio.update(dt, speed, this.world.horse.controller.airborne)
      this.mood?.update(dt)
    }

    if (!this.started && this.world?.ready) {
      // Behind the welcome screen: the horse breathes, the herds live, shadows follow
      const horse = this.world.horse
      horse.update(dt)
      this.world.lighting.update(dt, horse.mesh.position)
      this.world.herd.update(dt, horse.mesh.position)
    }

    this.world?.updateAmbient(dt)
    this.camera.update(dt)
    this.photoMode.update()
    if (this.world?.ready) this.emotes.update()
    this.renderer.update(dt)
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
