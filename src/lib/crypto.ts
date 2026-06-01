import 'server-only'
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto'

// AES-256-GCM encryption for secrets at rest (e.g. Plaid access tokens).
// Format: enc:v1:<ivHex>:<authTagHex>:<cipherHex>
const PREFIX = 'enc:v1:'
const ALGO = 'aes-256-gcm'

function getKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY ?? process.env.SESSION_SECRET
  if (!secret) throw new Error('ENCRYPTION_KEY (or SESSION_SECRET) must be set to encrypt secrets.')
  // Derive a stable 32-byte key from the secret
  return scryptSync(secret, 'ashtronomical-static-salt', 32)
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptSecret(value: string): string {
  // Backward compatibility: values stored before encryption are plaintext.
  if (!value.startsWith(PREFIX)) return value

  const body = value.slice(PREFIX.length)
  const [ivHex, authTagHex, cipherHex] = body.split(':')
  if (!ivHex || !authTagHex || !cipherHex) {
    throw new Error('Malformed encrypted secret.')
  }
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, 'hex')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX)
}
