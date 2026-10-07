import * as THREE from 'three'

const REASSIGN_EVERY = 12
const FADE_SPEED = 4

// Every lit shader pays for every point light, everywhere on the map.
// The pensions declare ~24 decorative lights; only a handful near the rider ever matter,
// so we keep a fixed pool (stable shader, no recompiles) and hand it to the nearest sources.
export default class LightPool {
  constructor(scene, size = 4) {
    this.scene = scene
    this.size = size
    this.sources = []
    this.slots = []
    this._frame = 0
  }

  // Detach every point light under `root` and turn it into a virtual source
  adopt(root) {
    root.updateMatrixWorld(true)
    const found = []
    root.traverse(o => { if (o.isPointLight) found.push(o) })

    for (const light of found) {
      const position = light.getWorldPosition(new THREE.Vector3())
      light.parent.remove(light)
      this.sources.push({ light, position, score: 0 })
    }

    const count = Math.min(this.size, this.sources.length)
    for (let i = 0; i < count; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 1)
      this.scene.add(light)
      this.slots.push({ light, source: null, next: null, fade: 0 })
    }
  }

  update(dt, focus) {
    if (!this.slots.length) return

    if (this._frame++ % REASSIGN_EVERY === 0) {
      // Closest light volumes first (distance to the edge of each light's reach)
      for (const s of this.sources) s.score = s.position.distanceTo(focus) - s.light.distance
      const wanted = [...this.sources].sort((a, b) => a.score - b.score).slice(0, this.slots.length)

      const free = this.slots.filter(slot => !wanted.includes(slot.source))
      for (const source of wanted) {
        if (this.slots.some(slot => slot.source === source || slot.next === source)) continue
        const slot = free.shift()
        if (slot) slot.next = source
      }
    }

    for (const slot of this.slots) {
      // Fade out, swap, fade back in so reassignments never pop
      if (slot.next) {
        slot.fade -= dt * FADE_SPEED
        if (slot.fade <= 0 || !slot.source) {
          slot.fade = 0
          slot.source = slot.next
          slot.next = null
          const { light, position } = slot.source
          slot.light.position.copy(position)
          slot.light.color.copy(light.color)
          slot.light.distance = light.distance
          slot.light.decay = light.decay
        }
      } else if (slot.source) {
        slot.fade = Math.min(slot.fade + dt * FADE_SPEED, 1)
      }
      slot.light.intensity = slot.source ? slot.source.light.intensity * slot.fade : 0
    }
  }
}
