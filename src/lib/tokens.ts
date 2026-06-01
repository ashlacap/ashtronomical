import 'server-only'
import { randomBytes } from 'crypto'
import { db } from '@/lib/db'

const EXPIRY_MS = {
  'email-verify': 24 * 60 * 60 * 1000, // 24h
  'password-reset': 60 * 60 * 1000, // 1h
} as const

export type TokenType = keyof typeof EXPIRY_MS

export async function createVerificationToken(userId: string, type: TokenType): Promise<string> {
  // Invalidate prior tokens of the same type
  await db.verificationToken.deleteMany({ where: { userId, type } })

  const token = randomBytes(32).toString('hex')
  await db.verificationToken.create({
    data: { userId, token, type, expiresAt: new Date(Date.now() + EXPIRY_MS[type]) },
  })
  return token
}

export async function consumeVerificationToken(token: string, type: TokenType): Promise<string | null> {
  const record = await db.verificationToken.findUnique({ where: { token } })
  if (!record || record.type !== type || record.expiresAt < new Date()) return null

  await db.verificationToken.delete({ where: { id: record.id } })
  return record.userId
}

export function appUrl(path: string): string {
  const base = process.env.APP_URL ?? 'http://localhost:3000'
  return `${base}${path}`
}
