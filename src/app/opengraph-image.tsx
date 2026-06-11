import { ImageResponse } from 'next/og'

export const alt = 'Ashtronomical — Your financial universe, mapped.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Deterministic starfield (golden-ratio spread) so the image is stable.
const stars = Array.from({ length: 70 }, (_, i) => {
  const x = (i * 137.508) % 100
  const y = (i * 97.381 + i * 0.6) % 100
  const s = i % 11 === 0 ? 4 : i % 4 === 0 ? 3 : 2
  const o = 0.18 + (i % 6) * 0.11
  return { x, y, s, o }
})

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          background: 'linear-gradient(150deg, #0a0a16 0%, #10122a 55%, #0a0a16 100%)',
          overflow: 'hidden',
        }}
      >
        {/* Stars */}
        {stars.map((st, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${st.x}%`,
              top: `${st.y}%`,
              width: st.s,
              height: st.s,
              borderRadius: '50%',
              background: '#ffffff',
              opacity: st.o,
            }}
          />
        ))}

        {/* Soft center glow */}
        <div
          style={{
            position: 'absolute',
            width: 760,
            height: 760,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, rgba(99,102,241,0) 70%)',
          }}
        />

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
          {/* Planet */}
          <div
            style={{
              position: 'relative',
              width: 280,
              height: 280,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* glow halo */}
            <div
              style={{
                position: 'absolute',
                width: 220,
                height: 220,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(160,170,210,0.22) 0%, rgba(160,170,210,0) 70%)',
              }}
            />
            {/* ring */}
            <div
              style={{
                position: 'absolute',
                width: 280,
                height: 104,
                borderRadius: '50%',
                border: '7px solid rgba(196,201,224,0.5)',
                transform: 'rotate(-18deg)',
              }}
            />
            {/* planet body */}
            <div
              style={{
                width: 150,
                height: 150,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 38% 30%, #444a63 0%, #262a3a 65%, #181b27 100%)',
                boxShadow: '0 0 40px rgba(0,0,0,0.45)',
              }}
            />
          </div>

          {/* Wordmark */}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 44 }}>
            <svg width="46" height="46" viewBox="0 0 24 24" fill="#ffffff" style={{ marginRight: 24 }}>
              <path d="M12 2L13.8 8.8L20.9 10L13.8 11.2L12 18L10.2 11.2L3.1 10L10.2 8.8L12 2Z" />
            </svg>
            <span
              style={{
                fontSize: 62,
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: 14,
              }}
            >
              ASHTRONOMICAL
            </span>
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 28,
              color: 'rgba(205,210,230,0.72)',
              marginTop: 18,
              letterSpacing: 1,
            }}
          >
            Your financial universe, mapped.
          </div>
        </div>
      </div>
    ),
    { ...size },
  )
}
