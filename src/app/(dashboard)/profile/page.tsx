import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import { format } from 'date-fns'
import { ProfileClient } from '@/components/ProfileClient'

export default async function ProfilePage() {
  const session = await requireAuth()
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, createdAt: true, emailVerified: true },
  })
  if (!user) return null

  return (
    <ProfileClient
      name={user.name ?? ''}
      email={user.email}
      createdAt={format(user.createdAt, 'MMMM d, yyyy')}
      emailVerified={user.emailVerified}
    />
  )
}
