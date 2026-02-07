export default class QuestBanner {
  constructor() {
    this.element = document.getElementById('quest-banner')
    this.textEl = document.getElementById('quest-text')
    this.stepEl = document.getElementById('quest-step')
    this._shimmerTimeout = null
  }

  show(text, step = null) {
    if (this.textEl) this.textEl.textContent = text
    if (this.stepEl) {
      this.stepEl.textContent = step || ''
      this.stepEl.style.display = step ? '' : 'none'
    }

    this.element?.classList.remove('hidden')
    this._triggerShimmer()
  }

  hide() {
    this.element?.classList.add('hidden')
    this.element?.classList.remove('shimmer-active')
    if (this._shimmerTimeout) {
      clearTimeout(this._shimmerTimeout)
      this._shimmerTimeout = null
    }
  }

  _triggerShimmer() {
    if (!this.element) return
    if (this._shimmerTimeout) clearTimeout(this._shimmerTimeout)
    this.element.classList.remove('shimmer-active')
    void this.element.offsetWidth
    this.element.classList.add('shimmer-active')

    this._shimmerTimeout = setTimeout(() => {
      this.element?.classList.remove('shimmer-active')
    }, 1300)
  }
}
