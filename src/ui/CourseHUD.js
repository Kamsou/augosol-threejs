import { formatTime } from '../world/JumpCourse.js'

// Stopwatch pill shown while the jumping course is running
export default class CourseHUD {
  constructor() {
    this.element = document.getElementById('course-hud')
    this.timeEl = document.getElementById('course-time')
    this.dotsEl = document.getElementById('course-dots')
    this.penaltyEl = document.getElementById('course-penalty')
    this._lastText = ''
  }

  show(count) {
    if (!this.element) return
    this.dotsEl.replaceChildren(...Array.from({ length: count }, () => {
      const dot = document.createElement('span')
      dot.className = 'course-dot'
      return dot
    }))
    this.dotsEl.firstElementChild?.classList.add('next')
    this.penaltyEl.textContent = ''
    this.element.classList.remove('hidden')
    document.body.classList.add('course-running')
  }

  hide() {
    this.element?.classList.add('hidden')
    document.body.classList.remove('course-running')
  }

  mark(index, result) {
    const dots = this.dotsEl?.children
    if (!dots) return
    dots[index]?.classList.remove('next')
    dots[index]?.classList.add(result)
    dots[index + 1]?.classList.add('next')
  }

  update(course) {
    if (!this.timeEl || course.state !== 'running') return
    const text = formatTime(course.time)
    if (text !== this._lastText) {
      this._lastText = text
      this.timeEl.textContent = text
    }
    const penalty = course.penalty ? `+${course.penalty} s` : ''
    if (this.penaltyEl.textContent !== penalty) this.penaltyEl.textContent = penalty
  }
}
