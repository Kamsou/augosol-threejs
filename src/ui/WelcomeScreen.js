export default class WelcomeScreen {
  constructor() {
    this.element = document.getElementById('welcome-screen')
    this.startBtn = document.getElementById('start-btn')
    this._onStart = null
  }

  show() {
    this.element?.classList.remove('hidden')
    requestAnimationFrame(() => {
      this.element?.classList.add('active')
    })
    if (this.startBtn) {
      this.startBtn.addEventListener('click', () => {
        this.startBtn.blur()
        document.activeElement?.blur()
        this.hide()
        this._onStart?.()
      }, { once: true })
    }
  }

  hide() {
    this.element?.classList.add('hidden')
  }

  onStart(fn) {
    this._onStart = fn
  }
}
