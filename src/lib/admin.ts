import 'server-only'
import { db } from '@/lib/db'

/**
 * True if the given user id is an admin — either the `isAdmin` flag on their
 * User row, or (for backward compatibility) they match the legacy
 * single-admin ADMIN_EMAIL env var. New admins should be granted via the
 * isAdmin column (see grantAdmin), not by changing ADMIN_EMAIL.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, isAdmin: true } })
  if (!user) return false
  if (user.isAdmin) return true

  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim()
  if (!adminEmail) return false
  return user.email.toLowerCase() === adminEmail
}
