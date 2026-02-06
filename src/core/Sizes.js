export default class Sizes {
  constructor() {
    this.width = window.innerWidth
    this.height = window.innerHeight
    this.pixelRatio = Math.min(window.devicePixelRatio, 2)
    this._listeners = []

    window.addEventListener('resize', () => {
      this.width = window.innerWidth
      this.height = window.innerHeight
      this.pixelRatio = Math.min(window.devicePixelRatio, 2)
      this._listeners.forEach(fn => fn())
    })
  }

  on(event, fn) {
    if (event === 'resize') this._listeners.push(fn)
  }
}
