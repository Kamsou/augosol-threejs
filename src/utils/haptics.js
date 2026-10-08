// Short vibrations on phones that support them (Android). iOS Safari has no Vibration API: no-op.
const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
  && ('ontouchstart' in window || navigator.maxTouchPoints > 0)

export function haptic(pattern) {
  if (!canVibrate) return
  try {
    navigator.vibrate(pattern)
  } catch {
    // Blocked until the first user gesture: ignore
  }
}
