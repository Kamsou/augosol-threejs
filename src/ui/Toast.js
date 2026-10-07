// Small stacked notifications at the top of the screen
export default class Toast {
  constructor() {
    this.container = document.getElementById('toast-stack')
  }

  show(title, subtitle = '', { variant = '', duration = 2600 } = {}) {
    if (!this.container) return
    const el = document.createElement('div')
    el.className = `toast ${variant}`.trim()

    const titleEl = document.createElement('span')
    titleEl.className = 'toast-title'
    titleEl.textContent = title
    el.appendChild(titleEl)

    if (subtitle) {
      const sub = document.createElement('span')
      sub.className = 'toast-sub'
      sub.textContent = subtitle
      el.appendChild(sub)
    }

    this.container.appendChild(el)
    // Keep at most three on screen
    while (this.container.children.length > 3) this.container.firstElementChild.remove()

    setTimeout(() => {
      el.classList.add('leaving')
      el.addEventListener('animationend', () => el.remove(), { once: true })
    }, duration)
  }
}
