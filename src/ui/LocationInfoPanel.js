import * as THREE from 'three'

export default class LocationInfoPanel {
  constructor() {
    this.element = document.getElementById('location-panel')
    this.nameEl = document.getElementById('panel-name')
    this.descriptionEl = document.getElementById('panel-description')
    this.featuresEl = document.getElementById('panel-features')
    this.iconEl = document.getElementById('panel-icon')
    this.badgeEl = document.getElementById('panel-ethical-badge')
    this.btnChoose = document.getElementById('btn-choose')
    this.btnContinue = document.getElementById('btn-continue')

    this._onChoose = null
    this._onContinue = null
    this._currentLocation = null

    this.btnChoose?.addEventListener('click', () => {
      this._onChoose?.(this._currentLocation)
    })

    this.btnContinue?.addEventListener('click', () => {
      this.hide()
      this._onContinue?.()
    })
  }

  show(locationKey, config) {
    this._currentLocation = { key: locationKey, config }

    if (this.nameEl) this.nameEl.textContent = config.name
    if (this.descriptionEl) this.descriptionEl.textContent = config.description

    if (this.iconEl) {
      const color = '#' + new THREE.Color(config.color).getHexString()
      this.iconEl.style.background = color + '33'
      this.iconEl.textContent = ''
    }

    if (this.badgeEl) {
      if (config.ethical) {
        this.badgeEl.className = 'ethical-badge ethical'
        this.badgeEl.textContent = 'Bien-être respecté'
      } else {
        this.badgeEl.className = 'ethical-badge unethical'
        this.badgeEl.textContent = 'Bien-être non respecté'
      }
    }

    if (this.featuresEl) {
      this.featuresEl.textContent = ''
      const tagClass = config.ethical ? 'ethical' : 'unethical'
      for (const f of config.features) {
        const span = document.createElement('span')
        span.className = `feature-tag ${tagClass}`
        span.textContent = f
        this.featuresEl.appendChild(span)
      }
    }

    if (this.btnChoose) {
      this.btnChoose.textContent = config.ethical
        ? 'Choisir cette pension'
        : 'Choisir quand même'
    }

    this.element?.classList.remove('hidden')
  }

  hide() {
    this.element?.classList.add('hidden')
    this._currentLocation = null
  }

  get isVisible() {
    return !this.element?.classList.contains('hidden')
  }

  onChoose(fn) { this._onChoose = fn }
  onContinue(fn) { this._onContinue = fn }
}
