import * as THREE from 'three'
import { BASE } from '../utils/Constants.js'

const FILTERS = ['Naturel', 'Heure dorée', 'Argentique', 'Rêve']
const _focus = new THREE.Vector3()

export default class PhotoMode {
  constructor(experience) {
    this.experience = experience
    this.active = false
    this.filter = 0
    this.dof = true

    this.element = document.getElementById('photo-ui')
    this.chips = document.getElementById('photo-filters')
    this.dofBtn = document.getElementById('photo-dof')
    this.captureBtn = document.getElementById('photo-capture')
    this.closeBtn = document.getElementById('photo-close')
    this.flash = document.getElementById('photo-flash')

    this._logo = new Image()
    this._logo.src = BASE + 'logo-augosol.png'

    this._buildFilters()
    this._bindEvents()
  }

  get supportsEffects() {
    return this.experience.renderer.supportsEffects
  }

  _buildFilters() {
    if (!this.chips) return
    if (!this.supportsEffects) {
      this.chips.remove()
      this.dofBtn?.remove()
      return
    }
    FILTERS.forEach((label, index) => {
      const chip = document.createElement('button')
      chip.className = 'photo-chip'
      chip.textContent = label
      chip.addEventListener('click', () => this.setFilter(index))
      this.chips.appendChild(chip)
    })
    this.setFilter(0)
  }

  setFilter(index) {
    this.filter = index
    this.experience.renderer.photoFilter = this.active ? index : 0
    this.chips?.querySelectorAll('.photo-chip').forEach((chip, i) => {
      chip.classList.toggle('active', i === index)
    })
  }

  _bindEvents() {
    this.captureBtn?.addEventListener('click', () => this.capture())
    this.closeBtn?.addEventListener('click', () => this.exit())
    this.dofBtn?.addEventListener('click', () => {
      this.dof = !this.dof
      this.dofBtn.classList.toggle('active', this.dof)
      this.experience.renderer.dof = this.active && this.dof ? 1 : 0
    })

    const canvas = this.experience.canvas
    const pointers = new Map()
    let pinchDist = 0

    canvas.addEventListener('pointerdown', (e) => {
      if (!this.active) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      canvas.setPointerCapture(e.pointerId)
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y)
      }
    })

    canvas.addEventListener('pointermove', (e) => {
      if (!this.active || !pointers.has(e.pointerId)) return
      const prev = pointers.get(e.pointerId)
      const dx = e.clientX - prev.x
      const dy = e.clientY - prev.y
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

      if (pointers.size === 1) {
        this.experience.camera.orbit(dx, dy)
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y)
        this.experience.camera.zoom((pinchDist - dist) * 4)
        pinchDist = dist
      }
    })

    const release = (e) => {
      pointers.delete(e.pointerId)
    }
    canvas.addEventListener('pointerup', release)
    canvas.addEventListener('pointercancel', release)

    canvas.addEventListener('wheel', (e) => {
      if (!this.active) return
      e.preventDefault()
      this.experience.camera.zoom(e.deltaY)
    }, { passive: false })
  }

  toggle() {
    if (this.active) this.exit()
    else this.enter()
  }

  enter() {
    const exp = this.experience
    const horse = exp.world?.horse
    if (this.active || !horse || horse.controller.airborne) return

    this.active = true
    this._wasFrozen = horse.controller.frozen
    horse.controller.frozen = true
    horse.controller.speed = 0

    exp.camera.enterPhotoMode()
    exp.renderer.photoFilter = this.filter
    exp.renderer.dof = this.dof ? 1 : 0
    this.dofBtn?.classList.toggle('active', this.dof)

    document.body.classList.add('photo-mode')
    this.element?.classList.remove('hidden')
  }

  exit() {
    if (!this.active) return
    const exp = this.experience
    this.active = false

    exp.world.horse.controller.frozen = this._wasFrozen
    exp.camera.exitPhotoMode()
    exp.renderer.photoFilter = 0
    exp.renderer.dof = 0

    document.body.classList.remove('photo-mode')
    this.element?.classList.add('hidden')
  }

  update() {
    if (!this.active || !this.supportsEffects) return
    // Keep the sharp zone on the horse wherever the orbit puts it on screen
    const horse = this.experience.world.horse.mesh
    _focus.copy(horse.position)
    _focus.y += 2.2
    _focus.project(this.experience.camera.instance)
    this.experience.renderer.finalPass.uniforms.uFocus.value.set(_focus.x * 0.5 + 0.5, _focus.y * 0.5 + 0.5)
  }

  capture() {
    if (!this.active) return
    const exp = this.experience
    const source = exp.canvas

    // Render and copy in the same task: the WebGL buffer is only valid until the next composite
    exp.renderer.update(0)
    const out = document.createElement('canvas')
    out.width = source.width
    out.height = source.height
    const ctx = out.getContext('2d')
    ctx.drawImage(source, 0, 0)
    this._watermark(ctx, out.width, out.height)

    out.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      link.href = url
      link.download = `augosol-${stamp}.png`
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')

    exp.audio?.shutter()
    exp.toast?.show('Photo enregistrée', 'Retrouvez-la dans vos téléchargements')

    if (this.flash) {
      this.flash.classList.remove('flash')
      void this.flash.offsetWidth
      this.flash.classList.add('flash')
    }
  }

  _watermark(ctx, width, height) {
    const pad = Math.round(height * 0.03)
    const logoH = Math.round(height * 0.05)
    ctx.save()
    ctx.globalAlpha = 0.85
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)'
    ctx.shadowBlur = 12
    if (this._logo.complete && this._logo.naturalWidth) {
      const logoW = logoH * (this._logo.naturalWidth / this._logo.naturalHeight)
      ctx.drawImage(this._logo, width - pad - logoW, height - pad - logoH, logoW, logoH)
    }
    ctx.restore()
  }
}
