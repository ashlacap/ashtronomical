import confetti from 'canvas-confetti'

/** A celebratory burst — used when a goal is completed or a debt is paid off. */
export function celebrate() {
  const duration = 1400
  const end = Date.now() + duration
  const colors = ['#a3e635', '#22c55e', '#6366f1', '#f59e0b', '#ec4899']

  ;(function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 60,
      origin: { x: 0, y: 0.7 },
      colors,
      disableForReducedMotion: true,
    })
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 60,
      origin: { x: 1, y: 0.7 },
      colors,
      disableForReducedMotion: true,
    })
    if (Date.now() < end) requestAnimationFrame(frame)
  })()

  // A central pop for good measure
  confetti({
    particleCount: 80,
    spread: 90,
    origin: { y: 0.6 },
    colors,
    disableForReducedMotion: true,
  })
}
