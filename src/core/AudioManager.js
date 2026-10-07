// Procedural soundscape: no audio files, everything is synthesised with WebAudio
const STORAGE_KEY = 'augosol-muted'

// Hoof rhythm per gait: animation cycle length (s), beat positions in the cycle,
// and the speed that maps to timeScale 1 (mirrors Horse.update)
const GAITS = {
  walk: { cycle: 1.46, beats: [0, 0.25, 0.5, 0.75], ref: 8, min: 0.5, max: 1.0, gain: 0.16 },
  trot: { cycle: 0.83, beats: [0, 0.5], ref: 12, min: 0.6, max: 1.1, gain: 0.22 },
  gallop: { cycle: 0.63, beats: [0, 0.13, 0.3, 0.44], ref: 17, min: 0.7, max: 1.2, gain: 0.26 },
  sprint: { cycle: 0.63, beats: [0, 0.12, 0.28, 0.4], ref: 22, min: 0.8, max: 1.2, gain: 0.3 },
}

// Major pentatonic: each horseshoe climbs one step
const PENTATONIC = [0, 2, 4, 7, 9]

function readMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeMuted(value) {
  try {
    localStorage.setItem(STORAGE_KEY, value ? '1' : '0')
  } catch {
    // Storage unavailable (private mode): the toggle still works for this session
  }
}

export default class AudioManager {
  constructor() {
    this.ctx = null
    this.muted = readMuted()
    this._gaitPhase = 0
    this._birdTimer = 4
    this._heartTimer = 0
    this.mood = 0
    this._listeners = []
  }

  // Must be called from a user gesture (start button)
  init() {
    if (this.ctx) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return

    const ctx = new AC()
    this.ctx = ctx

    this.master = ctx.createGain()
    this.master.gain.value = this.muted ? 0 : 0.9
    const compressor = ctx.createDynamicsCompressor()
    compressor.threshold.value = -18
    compressor.ratio.value = 4
    this.master.connect(compressor)
    compressor.connect(ctx.destination)

    const length = ctx.sampleRate * 2
    this._noise = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = this._noise.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1

    this._createWind()

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend()
      else ctx.resume()
    })
  }

  onChange(fn) {
    this._listeners.push(fn)
  }

  toggleMute() {
    this.muted = !this.muted
    writeMuted(this.muted)
    if (this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.1)
    }
    this._listeners.forEach(fn => fn(this.muted))
  }

  _noiseSource(loop = false) {
    const src = this.ctx.createBufferSource()
    src.buffer = this._noise
    src.loop = loop
    return src
  }

  _createWind() {
    const ctx = this.ctx

    // Soft breeze, slowly swept by an LFO
    const breeze = this._noiseSource(true)
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 420
    band.Q.value = 0.7
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 220
    lfo.connect(lfoGain).connect(band.frequency)
    this._breezeGain = ctx.createGain()
    this._breezeGain.gain.value = 0.06
    breeze.connect(band).connect(this._breezeGain).connect(this.master)

    // Rushing air that only rises at speed
    const rush = this._noiseSource(true)
    const high = ctx.createBiquadFilter()
    high.type = 'highpass'
    high.frequency.value = 900
    this._rushGain = ctx.createGain()
    this._rushGain.gain.value = 0
    rush.connect(high).connect(this._rushGain).connect(this.master)

    breeze.start()
    rush.start(0, 0.7)
    lfo.start()
  }

  update(dt, speed, airborne) {
    if (!this.ctx || this.ctx.state !== 'running') return
    const now = this.ctx.currentTime
    const absSpeed = Math.abs(speed)
    const ratio = Math.min(absSpeed / 32, 1)

    this._rushGain.gain.setTargetAtTime(ratio * ratio * 0.09, now, 0.3)
    this._breezeGain.gain.setTargetAtTime(0.05 + ratio * 0.03, now, 0.5)

    this._updateHooves(dt, absSpeed, airborne)

    // Birds fall silent where the horse feels bad; a low heartbeat takes over
    this._birdTimer -= dt
    if (this._birdTimer <= 0) {
      this._birdTimer = 5 + Math.random() * 10
      if (this.mood > -0.3) this._bird()
    }

    const tense = Math.max(-this.mood, 0)
    if (tense > 0.35) {
      this._heartTimer -= dt
      if (this._heartTimer <= 0) {
        this._heartTimer = 0.95
        this._heartbeat(0.16 * tense)
      }
    } else {
      this._heartTimer = 0
    }
  }

  _thump(start, gain) {
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(70, start)
    osc.frequency.exponentialRampToValueAtTime(38, start + 0.14)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(gain, start + 0.015)
    g.gain.exponentialRampToValueAtTime(0.0001, start + 0.2)
    osc.connect(g).connect(this.master)
    osc.start(start)
    osc.stop(start + 0.22)
  }

  _heartbeat(gain) {
    const t = this.ctx.currentTime
    this._thump(t, gain)
    this._thump(t + 0.22, gain * 0.7)
  }

  // Lip-fluttering snort: relaxed (low, long) or nervous (sharp, short)
  snort(nervous = false) {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const length = nervous ? 0.3 : 0.55

    const src = this._noiseSource()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.setValueAtTime(nervous ? 1400 : 700, t)
    bp.frequency.exponentialRampToValueAtTime(nervous ? 900 : 380, t + length)
    bp.Q.value = 1.4

    // Lips flapping = fast amplitude modulation
    const flutter = ctx.createGain()
    flutter.gain.value = 0.5
    const lfo = ctx.createOscillator()
    lfo.type = 'square'
    lfo.frequency.value = nervous ? 34 : 24
    const lfoDepth = ctx.createGain()
    lfoDepth.gain.value = 0.5
    lfo.connect(lfoDepth).connect(flutter.gain)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(nervous ? 0.3 : 0.22, t + 0.04)
    env.gain.exponentialRampToValueAtTime(0.0001, t + length)

    src.connect(bp).connect(flutter).connect(env).connect(this.master)
    src.start(t, Math.random(), length + 0.05)
    lfo.start(t)
    lfo.stop(t + length + 0.05)
  }

  // Soft, low nicker: what a horse does when it likes the attention
  nicker() {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const length = 0.75

    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(150, t)
    osc.frequency.exponentialRampToValueAtTime(105, t + length)

    const vibrato = ctx.createOscillator()
    vibrato.frequency.value = 7
    const vibratoDepth = ctx.createGain()
    vibratoDepth.gain.value = 12
    vibrato.connect(vibratoDepth).connect(osc.frequency)

    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 650
    lp.Q.value = 3

    // The "huh-huh-huh" pulse of a nicker
    const pulse = ctx.createGain()
    pulse.gain.value = 0.5
    const pulseLfo = ctx.createOscillator()
    pulseLfo.frequency.value = 11
    const pulseDepth = ctx.createGain()
    pulseDepth.gain.value = 0.5
    pulseLfo.connect(pulseDepth).connect(pulse.gain)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(0.13, t + 0.05)
    env.gain.exponentialRampToValueAtTime(0.0001, t + length)

    osc.connect(lp).connect(pulse).connect(env).connect(this.master)
    for (const node of [osc, vibrato, pulseLfo]) {
      node.start(t)
      node.stop(t + length + 0.05)
    }
  }

  _updateHooves(dt, speed, airborne) {
    let gait = null
    if (speed > 20) gait = GAITS.sprint
    else if (speed > 15) gait = GAITS.gallop
    else if (speed > 10) gait = GAITS.trot
    else if (speed > 0.3) gait = GAITS.walk

    if (!gait || airborne) {
      this._gaitPhase = 0
      return
    }

    const timeScale = Math.min(Math.max(speed / gait.ref, gait.min), gait.max)
    const prev = this._gaitPhase
    const next = prev + (dt * timeScale) / gait.cycle

    for (const beat of gait.beats) {
      const b = beat === 0 ? 1 : beat
      if (prev < b && next >= b) this.hoof(gait.gain * (0.8 + Math.random() * 0.4))
    }
    this._gaitPhase = next % 1
  }

  hoof(gain = 0.2) {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime

    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(140 + Math.random() * 30, t)
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.12)
    const g = ctx.createGain()
    g.gain.setValueAtTime(gain, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
    osc.connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + 0.18)

    const click = this._noiseSource()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 1100 + Math.random() * 500
    const cg = ctx.createGain()
    cg.gain.setValueAtTime(gain * 0.55, t)
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.06)
    click.connect(lp).connect(cg).connect(this.master)
    click.start(t, Math.random() * 1.5, 0.08)
  }

  _tone(freq, start, duration, gain, type = 'sine') {
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type = type
    osc.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, start)
    g.gain.exponentialRampToValueAtTime(gain, start + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration)
    osc.connect(g).connect(this.master)
    osc.start(start)
    osc.stop(start + duration + 0.05)
  }

  // Bright bell; climbs the pentatonic scale with each pickup
  chime(step = 0) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const degree = PENTATONIC[step % PENTATONIC.length] + 12 * Math.floor(step / PENTATONIC.length)
    const base = 659.25 * Math.pow(2, Math.min(degree, 24) / 12)
    this._tone(base, t, 0.9, 0.16)
    this._tone(base * 2, t, 0.5, 0.05)
    this._tone(base * 1.5, t + 0.07, 0.7, 0.08, 'triangle')
  }

  fanfare() {
    if (!this.ctx) return
    const t = this.ctx.currentTime + 0.25
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]
    notes.forEach((f, i) => this._tone(f, t + i * 0.11, 1.2, 0.12, 'triangle'))
    this._tone(1046.5, t + 0.6, 1.8, 0.08)
  }

  // Two rising beeps: the clock is running
  go() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this._tone(660, t, 0.18, 0.12, 'triangle')
    this._tone(990, t + 0.16, 0.4, 0.14, 'triangle')
  }

  // Wooden pole clattering down
  knock() {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    for (const [offset, gain] of [[0, 0.3], [0.13, 0.18], [0.22, 0.1]]) {
      const src = this._noiseSource()
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1500 + Math.random() * 400
      bp.Q.value = 6
      const g = ctx.createGain()
      g.gain.setValueAtTime(gain, t + offset)
      g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.09)
      src.connect(bp).connect(g).connect(this.master)
      src.start(t + offset, Math.random(), 0.1)
    }
    this._tone(140, t, 0.2, 0.15)
  }

  whoosh() {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const src = this._noiseSource()
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 1.2
    bp.frequency.setValueAtTime(300, t)
    bp.frequency.exponentialRampToValueAtTime(1800, t + 0.35)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.12)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
    src.connect(bp).connect(g).connect(this.master)
    src.start(t, Math.random(), 0.5)
  }

  land(impact = 10) {
    const strength = Math.min(impact / 10, 1.4)
    this.hoof(0.32 * strength)
    setTimeout(() => this.hoof(0.26 * strength), 70)
  }

  shutter() {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    for (const offset of [0, 0.06]) {
      const src = this._noiseSource()
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 2500
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.18, t + offset)
      g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.05)
      src.connect(hp).connect(g).connect(this.master)
      src.start(t + offset, Math.random(), 0.06)
    }
  }

  _bird() {
    const ctx = this.ctx
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    if (pan) {
      pan.pan.value = Math.random() * 1.6 - 0.8
      pan.connect(this.master)
    }
    const out = pan || this.master
    const chirps = 2 + Math.floor(Math.random() * 3)
    const base = 2600 + Math.random() * 1400
    let t = ctx.currentTime

    for (let i = 0; i < chirps; i++) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(base, t)
      osc.frequency.exponentialRampToValueAtTime(base * 1.35, t + 0.04)
      osc.frequency.exponentialRampToValueAtTime(base * 0.85, t + 0.1)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.035, t + 0.015)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11)
      osc.connect(g).connect(out)
      osc.start(t)
      osc.stop(t + 0.13)
      t += 0.13 + Math.random() * 0.08
    }
  }
}
