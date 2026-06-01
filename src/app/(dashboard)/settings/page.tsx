import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import { SettingsClient } from '@/components/SettingsClient'

export default async function SettingsPage() {
  const session = await requireAuth()
  const [user, bankAccounts] = await Promise.all([
    db.user.findUnique({
      where: { id: session.userId },
      select: {
        theme: true,
        currency: true,
        defaultPage: true,
        alertThreshold: true,
        budgetStartDay: true,
        weeklyDigest: true,
        emailAlerts: true,
      },
    }),
    db.bankAccount.findMany({
      where: { userId: session.userId },
      select: { id: true, institutionName: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  if (!user) return null

  return (
    <SettingsClient
      theme={user.theme}
      currency={user.currency}
      defaultPage={user.defaultPage}
      alertThreshold={user.alertThreshold}
      budgetStartDay={user.budgetStartDay}
      weeklyDigest={user.weeklyDigest}
      emailAlerts={user.emailAlerts}
      bankAccounts={bankAccounts.map((b) => ({
        id: b.id,
        institutionName: b.institutionName ?? 'Unknown Bank',
      }))}
    />
  )
}
