import { haptic } from '../utils/haptics.js'

export default class InputManager {
  constructor() {
    this._keys = {}
    this._listeners = {}
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    this.analog = { x: 0, y: 0, throttle: 0, active: false }
    if (this.isMobile) document.documentElement.classList.add('is-touch')

    // Typing in a field (the horse's name) must never trigger game shortcuts
    const isTyping = (e) => e.target instanceof Element && e.target.closest('input, textarea, [contenteditable="true"]')
    // Space/Enter on a focused button must keep activating it (keyboard users)
    const activatesControl = (e) => (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter')
      && e.target instanceof Element && e.target.closest('button, a[href], [role="button"], [role="radio"]')

    // A mouse/touch click must not leave a button focused, or the next Space would re-press it
    // instead of jumping. Keyboard activations (detail 0) keep their focus.
    window.addEventListener('click', (e) => {
      if (e.detail > 0 && e.target instanceof Element) e.target.closest('button')?.blur()
    })

    window.addEventListener('keydown', (e) => {
      if (isTyping(e) || activatesControl(e)) return
      const action = this._mapKey(e.code)
      if (action) {
        e.preventDefault()
        if (!this._keys[action]) {
          this._keys[action] = true
          this._emit(action, true)
        }
      }
    })

    window.addEventListener('keyup', (e) => {
      if (isTyping(e)) return
      const action = this._mapKey(e.code)
      if (action) {
        this._keys[action] = false
        this._emit(action, false)
      }
    })

    window.addEventListener('blur', () => {
      Object.keys(this._keys).forEach(k => { this._keys[k] = false })
    })

    if (this.isMobile) {
      this._setupTouch()
    }
  }

  _mapKey(code) {
    const map = {
      'KeyZ': 'forward',
      'KeyQ': 'left',
      'KeyS': 'backward',
      'KeyD': 'right',
      'KeyW': 'forward',
      'KeyA': 'left',
      'ArrowUp': 'forward',
      'ArrowLeft': 'left',
      'ArrowDown': 'backward',
      'ArrowRight': 'right',
      'ShiftLeft': 'gallop',
      'ShiftRight': 'gallop',
      'KeyE': 'interact',
      'Space': 'jump',
      'KeyP': 'photo',
      'KeyM': 'mute',
      'KeyC': 'pet',
      'Escape': 'escape',
    }
    return map[code] || null
  }

  // Floating analog stick: put a thumb anywhere in the steer zone and the stick appears under it.
  // Push distance is the throttle (walk → trot → gallop), sideways is the turn.
  _setupTouch() {
    const zone = document.getElementById('steer-zone')
    const stick = document.getElementById('joystick')
    const thumb = document.getElementById('joystick-thumb')
    const hint = document.getElementById('steer-hint')
    if (!zone || !stick || !thumb) return

    const RADIUS = 62
    const GALLOP_AT = 0.88
    let touchId = null
    let origin = { x: 0, y: 0 }
    let start = { x: 0, y: 0, t: 0 }
    let moved = false

    const setKey = (action, on) => {
      if (!!this._keys[action] === on) return
      this._keys[action] = on
      this._emit(action, on)
    }

    const place = (x, y) => {
      // Keep the whole stick on screen
      const margin = RADIUS + 14
      origin = {
        x: Math.min(Math.max(x, margin), window.innerWidth - margin),
        y: Math.min(Math.max(y, margin), window.innerHeight - margin),
      }
      stick.style.transform = `translate3d(${origin.x}px, ${origin.y}px, 0)`
    }

    const update = (x, y) => {
      let dx = x - origin.x
      let dy = y - origin.y
      const dist = Math.hypot(dx, dy)
      if (Math.hypot(x - start.x, y - start.y) > 12) moved = true
      if (dist > RADIUS) {
        dx = (dx / dist) * RADIUS
        dy = (dy / dist) * RADIUS
      }
      thumb.style.transform = `translate3d(${dx}px, ${dy}px, 0)`

      const nx = dx / RADIUS
      const ny = dy / RADIUS
      const mag = Math.min(dist / RADIUS, 1)
      // How much the push points "up": full throttle within ~60° of straight ahead,
      // a sideways push mostly turns at a walk
      const up = mag > 0 ? -ny / mag : 0
      const throttle = up < -0.5 ? -mag : mag * Math.min(Math.max((up + 0.3) / 0.8, 0), 1)

      this.analog.active = true
      this.analog.x = Math.abs(nx) > 0.12 ? nx : 0
      this.analog.y = ny
      this.analog.throttle = Math.abs(throttle) > 0.2 ? throttle : 0

      setKey('forward', this.analog.throttle > 0)
      setKey('backward', this.analog.throttle < -0.45)
      setKey('left', nx < -0.35)
      setKey('right', nx > 0.35)
      const galloping = this.analog.throttle >= GALLOP_AT
      if (galloping && !this._keys.gallop) haptic(8)
      setKey('gallop', galloping)
      stick.classList.toggle('galloping', galloping)
    }

    const release = () => {
      touchId = null
      this.analog.active = false
      this.analog.x = 0
      this.analog.y = 0
      this.analog.throttle = 0
      ;['forward', 'backward', 'left', 'right', 'gallop'].forEach(a => setKey(a, false))
      thumb.style.transform = 'translate3d(0, 0, 0)'
      // Back to its resting spot (the CSS default) so it doesn't linger mid-screen
      stick.style.transform = ''
      stick.classList.remove('active', 'galloping')
    }

    zone.addEventListener('touchstart', (e) => {
      e.preventDefault()
      if (touchId !== null) return
      const t = e.changedTouches[0]
      touchId = t.identifier
      start = { x: t.clientX, y: t.clientY, t: performance.now() }
      moved = false
      place(t.clientX, t.clientY)
      stick.classList.add('active')
      hint?.classList.add('done')
      update(t.clientX, t.clientY)
    }, { passive: false })

    zone.addEventListener('touchmove', (e) => {
      e.preventDefault()
      for (const t of e.changedTouches) {
        if (t.identifier === touchId) update(t.clientX, t.clientY)
      }
    }, { passive: false })

    const end = (e) => {
      e.preventDefault()
      for (const t of e.changedTouches) {
        if (t.identifier !== touchId) continue
        // A quick tap without dragging is not steering: let the game use it (petting the horse)
        const quick = performance.now() - start.t < 300
        release()
        if (quick && !moved) this._emit('tap', { x: t.clientX, y: t.clientY })
      }
    }
    zone.addEventListener('touchend', end, { passive: false })
    zone.addEventListener('touchcancel', end, { passive: false })

    const bindButton = (button, action) => {
      if (!button) return
      const press = (pressed) => (e) => {
        e.preventDefault()
        if (pressed) haptic(6)
        this._keys[action] = pressed
        this._emit(action, pressed)
        button.classList.toggle('active', pressed)
      }
      button.addEventListener('touchstart', press(true), { passive: false })
      button.addEventListener('touchend', press(false), { passive: false })
      button.addEventListener('touchcancel', press(false), { passive: false })
    }

    bindButton(document.getElementById('touch-interact'), 'interact')
    bindButton(document.getElementById('touch-jump'), 'jump')
  }

  isPressed(action) {
    return !!this._keys[action]
  }

  on(action, fn) {
    if (!this._listeners[action]) this._listeners[action] = []
    this._listeners[action].push(fn)
  }

  _emit(action, pressed) {
    if (this._listeners[action]) {
      this._listeners[action].forEach(fn => fn(pressed))
    }
  }
}
