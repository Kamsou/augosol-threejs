export default class HUD {
  constructor() {
    this.element = document.getElementById('hud')
    this.speedIndicator = document.getElementById('speed-indicator')

    // Minimap
    this._canvas = document.getElementById('minimap-canvas')
    this._ctx = this._canvas ? this._canvas.getContext('2d') : null
    this._northLabel = document.getElementById('minimap-north')
    this._minimapEl = document.getElementById('minimap')

    this._setupCanvas()
  }

  _setupCanvas() {
    if (!this._canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
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

  update(horsePosition, horseRotation, movementState, locationWorldData, questHint = null) {
    this._updateMinimap(horsePosition, horseRotation, locationWorldData, questHint)
    this._updateSpeed(movementState)
  }

  _updateMinimap(horsePos, horseRotation, locations, questHint) {
    const ctx = this._ctx
    if (!ctx) return

    const size = this._canvasSize
    const half = size / 2
    const dpr = this._dpr

    // Minimap shows a radius of 140 world units from the player
    const MAP_RADIUS = 140
    const scale = half / MAP_RADIUS

    // Clear
    ctx.clearRect(0, 0, size, size)

    // Clip to circle
    ctx.save()
    ctx.beginPath()
    ctx.arc(half, half, half, 0, Math.PI * 2)
    ctx.clip()

    // Background
    ctx.fillStyle = 'rgba(42, 26, 14, 0.6)'
    ctx.fillRect(0, 0, size, size)

    // Subtle terrain tint
    ctx.fillStyle = 'rgba(90, 120, 60, 0.08)'
    ctx.fillRect(0, 0, size, size)

    // Rotate context for player-up orientation
    ctx.translate(half, half)
    ctx.rotate(horseRotation)

    // Draw terrain boundary (500x500 centered at world origin)
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

    // Draw location dots
    const now = Date.now()
    for (const loc of locations) {
      const dx = (loc.x - horsePos.x) * scale
      const dz = (loc.z - horsePos.z) * scale

      const isTarget = this._isQuestTarget(loc, questHint)
      const dotRadius = (isTarget ? 5 : 3.5) * dpr

      // Quest target glow pulse
      if (isTarget) {
        const pulse = 0.25 + 0.25 * Math.sin(now * 0.004)
        ctx.beginPath()
        ctx.arc(dx, dz, dotRadius + 5 * dpr, 0, Math.PI * 2)
        ctx.fillStyle = loc.color
        ctx.globalAlpha = pulse
        ctx.fill()
        ctx.globalAlpha = 1.0
      }

      // Dot fill
      ctx.beginPath()
      ctx.arc(dx, dz, dotRadius, 0, Math.PI * 2)
      ctx.fillStyle = loc.color
      ctx.fill()

      // Dot border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 1 * dpr
      ctx.stroke()
    }

    ctx.restore() // undo rotation + clip

    // Draw player arrow at center (unrotated, always pointing up)
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

    // Position the "N" label on the ring edge
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
    if (!this.speedIndicator) return
    const labels = {
      idle: '',
      walk: 'Pas',
      trot: 'Trot',
      gallop: 'Galop',
    }
    this.speedIndicator.textContent = labels[state] || ''
  }
}
