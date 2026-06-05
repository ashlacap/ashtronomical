import 'server-only'
import { db } from '@/lib/db'

/** True if the given user id belongs to the configured admin (ADMIN_EMAIL). */
export async function isAdmin(userId: string): Promise<boolean> {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim()
  if (!adminEmail) return false
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } })
  return user?.email.toLowerCase() === adminEmail
}
