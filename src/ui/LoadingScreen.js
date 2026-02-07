const MESSAGES = [
  'Préparation du terrain',
  'Pansage du cheval',
  'Chargement de la nature',
  'Placement des pensions',
  'Derniers préparatifs',
]

export default class LoadingScreen {
  constructor() {
    this.element = document.getElementById('loading-screen')
    this.textEl = document.getElementById('loading-text')
    this.dotsEl = document.getElementById('loading-dots')
    this.line = document.getElementById('loading-line')
    this.glow = document.getElementById('loading-glow')
    this._displayProgress = 0
    this._targetProgress = 0
    this._msgIndex = 0
    this._dotCount = 0
    this._raf = null
    this._dotInterval = null

    if (this.textEl) this.textEl.textContent = MESSAGES[0]
    this._startDots()
    this._animate()
  }

  _startDots() {
    this._dotInterval = setInterval(() => {
      this._dotCount = (this._dotCount + 1) % 4
      if (this.dotsEl) this.dotsEl.textContent = '.'.repeat(this._dotCount)
    }, 400)
  }

  setProgress(progress) {
    this._targetProgress = Math.max(this._targetProgress, progress)

    const newIndex = Math.min(
      Math.floor(this._targetProgress * MESSAGES.length),
      MESSAGES.length - 1
    )
    if (newIndex !== this._msgIndex) {
      this._msgIndex = newIndex
      this._swapMessage(MESSAGES[newIndex])
    }
  }

  _swapMessage(text) {
    if (!this.textEl) return
    this.textEl.classList.add('fade-out')
    setTimeout(() => {
      this.textEl.textContent = text
      this.textEl.classList.remove('fade-out')
    }, 250)
  }

  _animate() {
    const step = () => {
      const diff = this._targetProgress - this._displayProgress
      if (Math.abs(diff) > 0.001) {
        this._displayProgress += diff * 0.06
      } else {
        this._displayProgress = this._targetProgress
      }

      const pct = Math.round(this._displayProgress * 100)

      if (this.line) {
        this.line.style.width = `${pct}%`
      }

      if (this.glow) {
        const size = 200 + this._displayProgress * 250
        this.glow.style.width = `${size}px`
        this.glow.style.height = `${size}px`
      }

      this._raf = requestAnimationFrame(step)
    }
    this._raf = requestAnimationFrame(step)
  }

  hide() {
    if (this._raf) cancelAnimationFrame(this._raf)
    if (this._dotInterval) clearInterval(this._dotInterval)

    return new Promise(resolve => {
      this.element?.classList.add('exit')

      setTimeout(() => {
        this.element?.classList.add('hidden')
        resolve()
      }, 900)
    })
  }
}
