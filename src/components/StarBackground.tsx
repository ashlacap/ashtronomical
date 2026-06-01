// Deterministic starfield — no Math.random(), SSR-safe.
// Golden ratio distribution (φ ≈ 137.508°) spreads stars naturally.
type Star = { cx: string; cy: string; r: number; opacity: number; duration: string }

function generateStars(count: number): Star[] {
  return Array.from({ length: count }, (_, i) => {
    const cx = ((i * 137.508) % 100).toFixed(2)
    const cy = ((i * 97.381 + i * 0.7) % 100).toFixed(2)
    const r = i % 11 === 0 ? 1.4 : i % 5 === 0 ? 1.0 : 0.65
    const opacity = 0.12 + (i % 13) * 0.035
    const duration = `${2.5 + (i % 7) * 0.6}s`
    return { cx: `${cx}%`, cy: `${cy}%`, r, opacity: parseFloat(opacity.toFixed(2)), duration }
  })
}

export function StarBackground({ count = 140, className = '' }: { count?: number; className?: string }) {
  const stars = generateStars(count)

  return (
    <div
      className={`pointer-events-none select-none overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        {stars.map((s, i) => (
          <circle
            key={i}
            cx={s.cx}
            cy={s.cy}
            r={s.r}
            fill="currentColor"
            opacity={s.opacity}
            className="star-twinkle"
            style={
              {
                '--star-opacity': s.opacity,
                '--star-duration': s.duration,
                animationDelay: `${(i * 0.07) % 4}s`,
              } as React.CSSProperties
            }
          />
        ))}
        {/* A few larger, brighter accent stars */}
        {[
          { cx: '15%', cy: '22%' },
          { cx: '72%', cy: '8%' },
          { cx: '88%', cy: '55%' },
          { cx: '33%', cy: '78%' },
          { cx: '60%', cy: '40%' },
        ].map((s, i) => (
          <g key={`bright-${i}`}>
            <circle cx={s.cx} cy={s.cy} r={1.8} fill="currentColor" opacity={0.55} className="star-twinkle"
              style={{ '--star-opacity': 0.55, '--star-duration': `${3 + i * 0.8}s`, animationDelay: `${i * 1.1}s` } as React.CSSProperties}
            />
            {/* cross sparkle */}
            <line x1={`calc(${s.cx} - 5px)`} y1={s.cy} x2={`calc(${s.cx} + 5px)`} y2={s.cy} stroke="currentColor" strokeWidth="0.5" opacity={0.25} />
            <line x1={s.cx} y1={`calc(${s.cy} - 5px)`} x2={s.cx} y2={`calc(${s.cy} + 5px)`} stroke="currentColor" strokeWidth="0.5" opacity={0.25} />
          </g>
        ))}
      </svg>
    </div>
  )
}
