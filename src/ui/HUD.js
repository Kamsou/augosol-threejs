const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

export default class HUD {
  constructor() {
    this.element = document.getElementById('hud')
    this.speedIndicator = document.getElementById('speed-indicator')

    this._canvas = document.getElementById('minimap-canvas')
    this._ctx = this._canvas ? this._canvas.getContext('2d') : null
    this._northLabel = document.getElementById('minimap-north')
    this._minimapEl = document.getElementById('minimap')
    this._frame = 0

    this._counterEl = document.getElementById('collect-count')
    this._counterPill = document.getElementById('collect-pill')
    this._gaitEl = this.speedIndicator
    this._lastGait = null

    this._setupCanvas()
  }

  setCollectibles(collected, total) {
    if (this._counterEl) this._counterEl.textContent = `${collected}/${total}`
    if (!this._counterPill) return
    this._counterPill.classList.toggle('complete', collected >= total)
    this._counterPill.classList.remove('bump')
    void this._counterPill.offsetWidth
    this._counterPill.classList.add('bump')
  }

  _setupCanvas() {
    if (!this._canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 2)
    const rect = this._canvas.parentElement.getBoundingClientRect()
    const cssSize = rect.width
    this._canvas.width = cssSize * dpr
    this._canvas.height = cssSize * dpr
    this._dpr = dpr
    this._canvasSize = cssSize * dpr
    this._cssSize = cssSize
  }

  show() {
    this.element?.classList.remove('hidden')
  }

  hide() {
    this.element?.classList.add('hidden')
  }

  update(horsePosition, horseRotation, movementState, locationWorldData, questHint = null, collectibles = null, course = null) {
    this._frame++
    if (!isMobile || this._frame % 4 === 0) {
      this._updateMinimap(horsePosition, horseRotation, locationWorldData, questHint, collectibles, course)
    }
    this._updateSpeed(movementState)
  }

  _updateMinimap(horsePos, horseRotation, locations, questHint, collectibles, course) {
    const ctx = this._ctx
    if (!ctx) return

    const size = this._canvasSize
    const half = size / 2
    const dpr = this._dpr

    const MAP_RADIUS = 140
    const scale = half / MAP_RADIUS

    ctx.clearRect(0, 0, size, size)

    ctx.save()
    ctx.beginPath()
    ctx.arc(half, half, half, 0, Math.PI * 2)
    ctx.clip()

    ctx.fillStyle = 'rgba(42, 26, 14, 0.6)'
    ctx.fillRect(0, 0, size, size)

    ctx.fillStyle = 'rgba(90, 120, 60, 0.08)'
    ctx.fillRect(0, 0, size, size)

    ctx.translate(half, half)
    ctx.rotate(horseRotation)

    const worldHalf = 250
    const bx = -horsePos.x * scale
    const bz = -horsePos.z * scale
    ctx.strokeStyle = 'rgba(245, 230, 208, 0.1)'
    ctx.lineWidth = 1 * dpr
    ctx.strokeRect(
      bx - worldHalf * scale,
      bz - worldHalf * scale,
      worldHalf * 2 * scale,
      worldHalf * 2 * scale
    )

    const now = Date.now()

    // Nearby golden horseshoes show up as twinkling diamonds
    if (collectibles) {
      const radarSq = 70 * 70
      const d = 2.6 * dpr
      ctx.fillStyle = '#ffc23d'
      for (const c of collectibles) {
        const wx = c.x - horsePos.x
        const wz = c.z - horsePos.z
        if (wx * wx + wz * wz > radarSq) continue
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now * 0.006 + c.x)
        ctx.beginPath()
        ctx.moveTo(wx * scale, wz * scale - d)
        ctx.lineTo(wx * scale + d, wz * scale)
        ctx.lineTo(wx * scale, wz * scale + d)
        ctx.lineTo(wx * scale - d, wz * scale)
        ctx.closePath()
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    // Jumping course: chequered flag at the arch, pulsing ring on the next jump
    if (course?.gate) {
      const gx = (course.gate.x - horsePos.x) * scale
      const gz = (course.gate.z - horsePos.z) * scale
      const f = 3 * dpr
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          ctx.fillStyle = (i + j) % 2 ? '#1c140e' : '#f5efe6'
          ctx.fillRect(gx - f + i * f, gz - f + j * f, f, f)
        }
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
      ctx.lineWidth = 1 * dpr
      ctx.strokeRect(gx - f, gz - f, f * 2, f * 2)
    }
    if (course?.next) {
      const nx = (course.next.x - horsePos.x) * scale
      const nz = (course.next.z - horsePos.z) * scale
      ctx.beginPath()
      ctx.arc(nx, nz, (3 + Math.sin(now * 0.008) * 1.2) * dpr, 0, Math.PI * 2)
      ctx.strokeStyle = '#ffc23d'
      ctx.lineWidth = 2 * dpr
      ctx.stroke()
    }

    for (const loc of locations) {
      const dx = (loc.x - horsePos.x) * scale
      const dz = (loc.z - horsePos.z) * scale

      const isTarget = this._isQuestTarget(loc, questHint)
      const dotRadius = (isTarget ? 5 : 3.5) * dpr

      if (isTarget) {
        const pulse = 0.25 + 0.25 * Math.sin(now * 0.004)
        ctx.beginPath()
        ctx.arc(dx, dz, dotRadius + 5 * dpr, 0, Math.PI * 2)
        ctx.fillStyle = loc.color
        ctx.globalAlpha = pulse
        ctx.fill()
        ctx.globalAlpha = 1.0
      }

      ctx.beginPath()
      ctx.arc(dx, dz, dotRadius, 0, Math.PI * 2)
      ctx.fillStyle = loc.color
      ctx.fill()

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 1 * dpr
      ctx.stroke()
    }

    ctx.restore()

    ctx.save()
    ctx.translate(half, half)
    const a = 8 * dpr
    ctx.beginPath()
    ctx.moveTo(0, -a)
    ctx.lineTo(-a * 0.5, a * 0.4)
    ctx.lineTo(0, a * 0.15)
    ctx.lineTo(a * 0.5, a * 0.4)
    ctx.closePath()
    ctx.fillStyle = 'rgba(245, 158, 11, 0.95)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.lineWidth = 1 * dpr
    ctx.stroke()
    ctx.restore()

    if (this._northLabel) {
      const cssHalf = this._cssSize / 2
      const labelRadius = cssHalf + 9
      const northAngle = horseRotation - Math.PI / 2
      const nx = cssHalf + Math.cos(northAngle) * labelRadius
      const ny = cssHalf + Math.sin(northAngle) * labelRadius
      this._northLabel.style.left = `${nx}px`
      this._northLabel.style.top = `${ny}px`
      this._northLabel.style.transform = 'translate(-50%, -50%)'
    }
  }

  _isQuestTarget(loc, questHint) {
    if (!questHint) return false
    if (questHint.targetKey && questHint.targetKey === loc.key) return true
    if (questHint.targetEthical && loc.ethical) return true
    return false
  }

  _updateSpeed(state) {
    if (!this._gaitEl || state === this._lastGait) return
    this._lastGait = state
    const labels = { idle: 'Arrêt', walk: 'Pas', trot: 'Trot', gallop: 'Galop' }
    const level = { idle: 0, walk: 1, trot: 2, gallop: 3 }[state] ?? 0
    this._gaitEl.dataset.level = level
    const label = this._gaitEl.querySelector('.gait-label')
    if (label) label.textContent = labels[state] || ''
  }
}
