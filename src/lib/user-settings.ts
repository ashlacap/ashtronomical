import 'server-only'
import { cache } from 'react'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'

export type UserSettings = {
  currency: string
  alertThreshold: number
  budgetStartDay: number
  defaultPage: string
  theme: string
}

const DEFAULT_SETTINGS: UserSettings = {
  currency: 'USD',
  alertThreshold: 80,
  budgetStartDay: 1,
  defaultPage: '/dashboard',
  theme: 'system',
}

export const getUserSettings = cache(async (): Promise<UserSettings> => {
  const session = await getSession()
  if (!session?.userId) return DEFAULT_SETTINGS

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      currency: true,
      alertThreshold: true,
      budgetStartDay: true,
      defaultPage: true,
      theme: true,
    },
  })

  return user ?? DEFAULT_SETTINGS
})
