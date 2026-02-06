export default class Time {
  constructor() {
    this._listeners = []
    this.elapsed = 0
    this.delta = 16
    this._previousTime = performance.now()
    this._raf = null

    this._tick()
  }

  _tick() {
    const currentTime = performance.now()
    this.delta = Math.min(currentTime - this._previousTime, 50) // Cap at 50ms
    this._previousTime = currentTime
    this.elapsed += this.delta

    this._listeners.forEach(fn => fn())

    this._raf = window.requestAnimationFrame(() => this._tick())
  }

  on(event, fn) {
    if (event === 'tick') this._listeners.push(fn)
  }

  get deltaSeconds() {
    return this.delta / 1000
  }
}
