export default class InteractionPrompt {
  constructor() {
    this.element = document.getElementById('interaction-prompt')
    this.textElement = document.getElementById('prompt-text')
    this._onTap = null

    if (this.element) {
      this.element.addEventListener('click', () => {
        if (this._onTap) this._onTap()
      })
    }
  }

  show(locationName) {
    if (this.textElement) {
      this.textElement.textContent = `Decouvrir "${locationName}"`
    }
    this.element?.classList.remove('hidden')
  }

  hide() {
    this.element?.classList.add('hidden')
  }

  onTap(fn) {
    this._onTap = fn
  }
}
