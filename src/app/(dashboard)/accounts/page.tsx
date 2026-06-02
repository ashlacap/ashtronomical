import { requireAuth } from '@/lib/session'
import { db } from '@/lib/db'
import { format } from 'date-fns'
import { disconnectAccount } from '@/app/actions/plaid'
import { PlaidLinkButton } from '@/components/PlaidLinkButton'
import { SyncButton } from '@/components/SyncButton'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Building2, Trash2 } from 'lucide-react'
import { getUserSettings } from '@/lib/user-settings'
import { formatCurrency as fmtCurrency } from '@/lib/currency'
import { ManualAssetsCard } from '@/components/ManualAssetsCard'
import type { BankAccount, PlaidAccount } from '@/generated/prisma/client'

type BankAccountWithAccounts = BankAccount & { plaidAccounts: PlaidAccount[] }

export default async function AccountsPage() {
  const session = await requireAuth()
  const { currency } = await getUserSettings()
  const formatCurrency = (n: number) => fmtCurrency(n, currency)

  const [bankAccounts, manualAssets, debtAgg] = await Promise.all([
    db.bankAccount.findMany({
      where: { userId: session.userId },
      include: { plaidAccounts: true },
      orderBy: { createdAt: 'desc' },
    }) as Promise<BankAccountWithAccounts[]>,
    db.manualAsset.findMany({ where: { userId: session.userId }, orderBy: { value: 'desc' } }),
    db.debt.aggregate({ where: { userId: session.userId }, _sum: { balance: true } }),
  ])

  const allPlaidAccounts = bankAccounts.flatMap((b: BankAccountWithAccounts) => b.plaidAccounts)
  // Only depository accounts (checking/savings) are assets.
  const bankBalance = allPlaidAccounts
    .filter((a: PlaidAccount) => a.type === 'depository')
    .reduce((sum: number, a: PlaidAccount) => sum + (a.currentBalance ?? 0), 0)
  // Credit cards and loans are debt, not assets.
  const plaidDebt = allPlaidAccounts
    .filter((a: PlaidAccount) => a.type === 'credit' || a.type === 'loan')
    .reduce((sum: number, a: PlaidAccount) => sum + (a.currentBalance ?? 0), 0)
  const assetsTotal = manualAssets.reduce((s, a) => s + a.value, 0)
  const manualDebt = debtAgg._sum.balance ?? 0
  const totalDebt = manualDebt + plaidDebt
  const netWorth = bankBalance + assetsTotal - totalDebt

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Stations <span className="text-base font-normal text-muted-foreground ml-1">— Accounts</span></h1>
          <p className="text-muted-foreground text-sm">Bank accounts, assets, and your net worth.</p>
        </div>
        <div className="flex gap-2">
          {bankAccounts.length > 0 && <SyncButton label="Sync all" />}
          <PlaidLinkButton />
        </div>
      </div>

      {/* Net worth */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="pt-5">
          <p className="text-sm opacity-80">Net Worth</p>
          <p className="text-3xl font-bold">{formatCurrency(netWorth)}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm opacity-70 mt-2">
            <span>Bank: {formatCurrency(bankBalance)}</span>
            <span>Other assets: {formatCurrency(assetsTotal)}</span>
            <span>Debt: −{formatCurrency(totalDebt)}</span>
          </div>
        </CardContent>
      </Card>

      {bankAccounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Building2 className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">No stations docked</p>
              <p className="text-sm text-muted-foreground mt-1">
                Dock a station to begin importing transmissions automatically.
              </p>
            </div>
            <PlaidLinkButton />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bankAccounts.map((bank: BankAccountWithAccounts) => (
            <Card key={bank.id}>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{bank.institutionName ?? 'Unknown Institution'}</CardTitle>
                    <CardDescription>Connected {format(bank.createdAt, 'MMM d, yyyy')}</CardDescription>
                  </div>
                </div>
                <form action={disconnectAccount.bind(null, bank.id)}>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" />
                    Disconnect
                  </Button>
                </form>
              </CardHeader>
              <CardContent className="space-y-0">
                {bank.plaidAccounts.map((account: PlaidAccount, i: number) => (
                  <div key={account.id}>
                    <div className="flex items-center justify-between py-2.5">
                      <div>
                        <p className="text-sm font-medium">{account.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {account.type} {account.mask ? `••••${account.mask}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        {(() => {
                          const isDebt = account.type === 'credit' || account.type === 'loan'
                          return (
                            <>
                              {account.currentBalance != null && (
                                <p className={`text-sm font-semibold ${isDebt ? 'text-red-500' : ''}`}>
                                  {isDebt ? '−' : ''}{formatCurrency(account.currentBalance)}
                                  {isDebt && <span className="text-xs font-normal text-muted-foreground ml-1">owed</span>}
                                </p>
                              )}
                              {account.availableBalance != null && account.availableBalance !== account.currentBalance && (
                                <p className="text-xs text-muted-foreground">
                                  {formatCurrency(account.availableBalance)} {isDebt ? 'available credit' : 'available'}
                                </p>
                              )}
                              <Badge variant="secondary" className="text-xs mt-0.5">{account.subtype ?? account.type}</Badge>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                    {i < bank.plaidAccounts.length - 1 && <Separator />}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Manual assets */}
      <ManualAssetsCard assets={manualAssets.map((a) => ({ id: a.id, name: a.name, value: a.value, type: a.type }))} />
    </div>
  )
}
