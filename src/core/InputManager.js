export default class InputManager {
  constructor() {
    this._keys = {}
    this._listeners = {}
    this.isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    this.analog = { x: 0, y: 0 }

    window.addEventListener('keydown', (e) => {
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
    }
    return map[code] || null
  }

  _setupTouch() {
    const joystickZone = document.getElementById('joystick-zone')
    const joystickThumb = document.getElementById('joystick-thumb')
    const gallopBtn = document.getElementById('touch-gallop')
    const interactBtn = document.getElementById('touch-interact')

    if (!joystickZone || !joystickThumb) return

    let joystickActive = false
    let joystickCenter = { x: 0, y: 0 }
    const maxRadius = 55

    const updateJoystick = (touchX, touchY) => {
      const rect = joystickZone.getBoundingClientRect()
      joystickCenter = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      }

      let dx = touchX - joystickCenter.x
      let dy = touchY - joystickCenter.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist > maxRadius) {
        dx = (dx / dist) * maxRadius
        dy = (dy / dist) * maxRadius
      }

      joystickThumb.style.transform = `translate(${dx}px, ${dy}px)`

      const nx = dx / maxRadius
      const ny = dy / maxRadius

      const deadZone = 0.35
      this.analog.x = Math.abs(nx) > deadZone ? nx : 0
      this.analog.y = Math.abs(ny) > deadZone ? ny : 0

      const wasForward = this._keys['forward']
      const wasBackward = this._keys['backward']
      this._keys['forward'] = ny < -deadZone
      this._keys['backward'] = ny > deadZone
      if (this._keys['forward'] && !wasForward) this._emit('forward', true)
      if (!this._keys['forward'] && wasForward) this._emit('forward', false)
      if (this._keys['backward'] && !wasBackward) this._emit('backward', true)
      if (!this._keys['backward'] && wasBackward) this._emit('backward', false)

      const wasLeft = this._keys['left']
      const wasRight = this._keys['right']
      this._keys['left'] = nx < -deadZone
      this._keys['right'] = nx > deadZone
      if (this._keys['left'] && !wasLeft) this._emit('left', true)
      if (!this._keys['left'] && wasLeft) this._emit('left', false)
      if (this._keys['right'] && !wasRight) this._emit('right', true)
      if (!this._keys['right'] && wasRight) this._emit('right', false)
    }

    const resetJoystick = () => {
      joystickActive = false
      joystickThumb.style.transform = 'translate(0, 0)'
      this.analog.x = 0
      this.analog.y = 0
      ;['forward', 'backward', 'left', 'right'].forEach(action => {
        if (this._keys[action]) {
          this._keys[action] = false
          this._emit(action, false)
        }
      })
    }

    joystickZone.addEventListener('touchstart', (e) => {
      e.preventDefault()
      joystickActive = true
      const t = e.touches[0]
      updateJoystick(t.clientX, t.clientY)
    }, { passive: false })

    joystickZone.addEventListener('touchmove', (e) => {
      e.preventDefault()
      if (!joystickActive) return
      const t = e.touches[0]
      updateJoystick(t.clientX, t.clientY)
    }, { passive: false })

    joystickZone.addEventListener('touchend', (e) => {
      e.preventDefault()
      resetJoystick()
    }, { passive: false })

    joystickZone.addEventListener('touchcancel', (e) => {
      e.preventDefault()
      resetJoystick()
    }, { passive: false })

    if (gallopBtn) {
      gallopBtn.addEventListener('touchstart', (e) => {
        e.preventDefault()
        this._keys['gallop'] = true
        this._emit('gallop', true)
        gallopBtn.classList.add('active')
      }, { passive: false })

      gallopBtn.addEventListener('touchend', (e) => {
        e.preventDefault()
        this._keys['gallop'] = false
        this._emit('gallop', false)
        gallopBtn.classList.remove('active')
      }, { passive: false })

      gallopBtn.addEventListener('touchcancel', (e) => {
        e.preventDefault()
        this._keys['gallop'] = false
        this._emit('gallop', false)
        gallopBtn.classList.remove('active')
      }, { passive: false })
    }

    if (interactBtn) {
      interactBtn.addEventListener('touchstart', (e) => {
        e.preventDefault()
        this._keys['interact'] = true
        this._emit('interact', true)
        interactBtn.classList.add('active')
      }, { passive: false })

      interactBtn.addEventListener('touchend', (e) => {
        e.preventDefault()
        this._keys['interact'] = false
        this._emit('interact', false)
        interactBtn.classList.remove('active')
      }, { passive: false })

      interactBtn.addEventListener('touchcancel', (e) => {
        e.preventDefault()
        this._keys['interact'] = false
        this._emit('interact', false)
        interactBtn.classList.remove('active')
      }, { passive: false })
    }
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
