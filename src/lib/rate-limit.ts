import 'server-only'

// Simple in-memory sliding-window rate limiter. Suitable for a single
// instance; swap for Redis/Upstash when running multiple instances.
type Attempt = { count: number; firstAt: number; lockedUntil?: number }

const store = new Map<string, Attempt>()

const WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000 // lock for 15 min after exceeding

export type RateLimitResult = {
  allowed: boolean
  retryAfterSeconds?: number
  remaining: number
}

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry) return { allowed: true, remaining: MAX_ATTEMPTS - 1 }

  // Currently locked out
  if (entry.lockedUntil && entry.lockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((entry.lockedUntil - now) / 1000), remaining: 0 }
  }

  // Window expired — reset
  if (now - entry.firstAt > WINDOW_MS) {
    store.delete(key)
    return { allowed: true, remaining: MAX_ATTEMPTS - 1 }
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil(LOCKOUT_MS / 1000), remaining: 0 }
  }

  return { allowed: true, remaining: MAX_ATTEMPTS - entry.count - 1 }
}

export function recordFailure(key: string): void {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now - entry.firstAt > WINDOW_MS) {
    store.set(key, { count: 1, firstAt: now })
    return
  }

  entry.count++
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS
  }
  store.set(key, entry)
}

export function clearRateLimit(key: string): void {
  store.delete(key)
}
