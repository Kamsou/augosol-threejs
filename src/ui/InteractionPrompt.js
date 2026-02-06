export default class InteractionPrompt {
  constructor() {
    this.element = document.getElementById('interaction-prompt')
    this.textElement = document.getElementById('prompt-text')
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
}
