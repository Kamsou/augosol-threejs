import * as THREE from 'three'

const NS = 'http://www.w3.org/2000/svg'
const ICONS = {
  heart: 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.2 5.2 3 1.6-1.8 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z',
  alert: 'M12 3v11M12 19.5v.5',
  calm: 'M4 14c2.5-3 5.5-3 8 0s5.5 3 8 0M4 8c2.5-3 5.5-3 8 0s5.5 3 8 0',
}

const _head = new THREE.Vector3()

function icon(kind) {
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', kind === 'heart' ? 'currentColor' : 'none')
  svg.setAttribute('stroke', 'currentColor')
  svg.setAttribute('stroke-width', kind === 'alert' ? '3' : '2')
  svg.setAttribute('stroke-linecap', 'round')
  const path = document.createElementNS(NS, 'path')
  path.setAttribute('d', ICONS[kind])
  svg.appendChild(path)
  return svg
}

// Speech-bubble style reactions that float above the horse's head
export default class HorseEmotes {
  constructor(experience) {
    this.experience = experience
    this.layer = document.getElementById('emote-layer')
    this._bubble = null
    this._bubbleTimer = null
  }

  // kind: 'heart' (bien-être), 'alert' (mal-être), 'calm'
  say(kind, label = '', duration = 3200) {
    if (!this.layer) return
    this._bubble?.remove()
    clearTimeout(this._bubbleTimer)

    const bubble = document.createElement('div')
    bubble.className = `emote-bubble ${kind}`
    const badge = document.createElement('span')
    badge.className = 'emote-icon'
    badge.appendChild(icon(kind))
    bubble.appendChild(badge)
    if (label) {
      const text = document.createElement('span')
      text.className = 'emote-label'
      text.textContent = label
      bubble.appendChild(text)
    }
    this.layer.appendChild(bubble)
    this._bubble = bubble

    this._bubbleTimer = setTimeout(() => {
      bubble.classList.add('leaving')
      bubble.addEventListener('animationend', () => bubble.remove(), { once: true })
      if (this._bubble === bubble) this._bubble = null
    }, duration)
  }

  hearts(count = 5) {
    if (!this.layer) return
    for (let i = 0; i < count; i++) {
      const heart = document.createElement('span')
      heart.className = 'emote-heart'
      heart.appendChild(icon('heart'))
      heart.style.setProperty('--dx', `${(Math.random() - 0.5) * 90}px`)
      heart.style.setProperty('--rot', `${(Math.random() - 0.5) * 50}deg`)
      heart.style.setProperty('--size', `${14 + Math.random() * 14}px`)
      heart.style.animationDelay = `${i * 0.09}s`
      heart.addEventListener('animationend', () => heart.remove(), { once: true })
      this.layer.appendChild(heart)
    }
  }

  update() {
    if (!this.layer || !this.layer.childElementCount) return
    const { world, camera, sizes } = this.experience
    world.horse.getHeadPosition(_head)
    _head.y += 1.1
    _head.project(camera.instance)
    const behind = _head.z > 1
    const x = (_head.x * 0.5 + 0.5) * sizes.width
    const y = (-_head.y * 0.5 + 0.5) * sizes.height
    this.layer.style.transform = `translate3d(${x}px, ${y}px, 0)`
    this.layer.style.opacity = behind ? '0' : '1'
  }
}
