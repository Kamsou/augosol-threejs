import Profile, { PLAYER_COATS } from '../core/Profile.js'

// First screen: name your horse, pick its coat on the live 3D horse, then ride
export default class WelcomeScreen {
  constructor() {
    this.element = document.getElementById('welcome-screen')
    this.startBtn = document.getElementById('start-btn')
    this.nameInput = document.getElementById('horse-name')
    this.nameMirror = this.element?.querySelector('.name-mirror')
    this.hintText = document.getElementById('name-hint-text')
    this.swatches = document.getElementById('coat-swatches')
    this.coatName = document.getElementById('coat-name')
    this._onStart = null
    this._onCoat = null
  }

  // Fill the form from the saved profile and keep it in sync
  bind(profile) {
    this.profile = profile

    if (this.nameInput) {
      this.nameInput.value = profile.name
      this._sizeName()
      this.nameInput.addEventListener('input', () => {
        const clean = Profile.clean(this.nameInput.value)
        if (clean !== this.nameInput.value) this.nameInput.value = clean
        profile.name = clean
        this._sizeName()
        this._updateHint()
      })
    }
    this._updateHint()

    if (this.swatches) {
      this.swatches.setAttribute('role', 'radiogroup')
      this.swatches.setAttribute('aria-label', 'Robe du cheval')
      this.swatches.replaceChildren(...PLAYER_COATS.map((coat) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'coat-swatch'
        button.setAttribute('role', 'radio')
        button.setAttribute('aria-label', coat.label)
        button.title = coat.label
        button.style.setProperty('--body', coat.swatch[0])
        button.style.setProperty('--mane', coat.swatch[1])
        button.addEventListener('click', () => this._selectCoat(coat.id, true))
        button.addEventListener('keydown', (e) => {
          // Arrow keys move through the swatches like a native radio group
          const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
          if (!step) return
          e.preventDefault()
          const index = PLAYER_COATS.findIndex(c => c.id === this.profile.coat)
          const next = PLAYER_COATS[(index + step + PLAYER_COATS.length) % PLAYER_COATS.length]
          this._selectCoat(next.id, true)
          this.swatches.children[PLAYER_COATS.indexOf(next)]?.focus()
        })
        return button
      }))
    }
    this._selectCoat(profile.coat, false)
  }

  _sizeName() {
    if (!this.nameInput || !this.nameMirror) return
    this.nameMirror.textContent = this.nameInput.value || this.nameInput.placeholder
    this.nameInput.style.width = `${this.nameMirror.offsetWidth + 4}px`
  }

  _updateHint() {
    if (!this.hintText) return
    const name = this.profile?.name.trim()
    this.hintText.textContent = name
      ? `${name} vous attend. Choisissez sa robe, puis en selle.`
      : 'Écrivez son nom, il vous accompagnera tout au long de la balade'
  }

  _selectCoat(id, fromUser) {
    this.profile.coat = id
    const coat = this.profile.coatDef
    for (const [i, button] of [...(this.swatches?.children || [])].entries()) {
      const selected = PLAYER_COATS[i].id === id
      button.setAttribute('aria-checked', String(selected))
      button.tabIndex = selected ? 0 : -1
    }
    if (this.coatName) this.coatName.textContent = coat.label
    this._onCoat?.(coat, fromUser)
  }

  show() {
    this.element?.classList.remove('hidden')
    requestAnimationFrame(() => {
      this.element?.classList.add('active')
      // Fonts may arrive after first layout: re-measure the name field
      document.fonts?.ready.then(() => this._sizeName())
    })
    if (!this.startBtn) return

    const start = () => {
      window.removeEventListener('keydown', onKey)
      this.profile?.save()
      this.startBtn.blur()
      document.activeElement?.blur()
      this.hide()
      this._onStart?.()
    }
    // Enter starts from anywhere, including the name field
    const onKey = (e) => {
      // A focused button (a coat swatch) handles Enter itself: select, don't start
      if (e.target instanceof Element && e.target.closest('button')) return
      if (e.key === 'Enter') {
        e.preventDefault()
        this.startBtn.click()
      }
    }
    window.addEventListener('keydown', onKey)
    this.startBtn.addEventListener('click', start, { once: true })
  }

  hide() {
    this.element?.classList.add('hidden')
  }

  onStart(fn) {
    this._onStart = fn
  }

  onCoat(fn) {
    this._onCoat = fn
  }
}
