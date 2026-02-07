export default class LoadingScreen {
  constructor() {
    this.element = document.getElementById('loading-screen')
    this.number = document.getElementById('loading-number')
    this.line = document.getElementById('loading-line')
    this.glow = document.getElementById('loading-glow')
    this._displayProgress = 0
    this._targetProgress = 0
    this._raf = null
    this._animate()
  }

  setProgress(progress) {
    this._targetProgress = Math.max(this._targetProgress, progress)
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

      if (this.number) {
        this.number.textContent = pct
        this.number.style.opacity = 0.12 + this._displayProgress * 0.2
      }

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

    return new Promise(resolve => {
      this.element?.classList.add('exit')

      setTimeout(() => {
        this.element?.classList.add('hidden')
        resolve()
      }, 900)
    })
  }
}
