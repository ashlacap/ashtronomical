import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import { HouseholdClient } from '@/components/HouseholdClient'

export default async function HouseholdPage() {
  const session = await requireAuth()
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, householdId: true },
  })

  let household = null
  if (user?.householdId) {
    const h = await db.household.findUnique({
      where: { id: user.householdId },
      include: {
        members: { select: { id: true, name: true, email: true } },
        invites: { select: { id: true, email: true, createdAt: true } },
      },
    })
    if (h) {
      household = {
        id: h.id,
        name: h.name,
        ownerId: h.ownerId,
        members: h.members.map((m) => ({ id: m.id, name: m.name ?? '', email: m.email })),
        invites: h.invites.map((i) => ({ id: i.id, email: i.email })),
      }
    }
  }

  return <HouseholdClient currentUserId={session.userId} household={household} />
}
