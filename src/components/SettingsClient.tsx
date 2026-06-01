'use client'

import { useActionState, useEffect, useTransition } from 'react'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'
import { updateSettings } from '@/app/actions/user'
import { disconnectAccount } from '@/app/actions/plaid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Download, Moon, Sun, Monitor, Landmark, Trash2 } from 'lucide-react'

const PAGES = [
  { value: '/dashboard',    label: 'Mission Control (Overview)' },
  { value: '/budget',       label: 'Fuel Allocation (Budget)' },
  { value: '/transactions', label: 'Transmissions (Transactions)' },
  { value: '/goals',        label: 'Missions (Savings Goals)' },
  { value: '/debt',         label: 'Black Holes (Debt)' },
  { value: '/insights',     label: 'Star Charts (Insights)' },
  { value: '/events',       label: 'Events' },
]

const CURRENCIES = [
  { code: 'USD', label: 'USD — US Dollar ($)' },
  { code: 'EUR', label: 'EUR — Euro (€)' },
  { code: 'GBP', label: 'GBP — British Pound (£)' },
  { code: 'CAD', label: 'CAD — Canadian Dollar (CA$)' },
  { code: 'AUD', label: 'AUD — Australian Dollar (A$)' },
  { code: 'JPY', label: 'JPY — Japanese Yen (¥)' },
  { code: 'MXN', label: 'MXN — Mexican Peso (MX$)' },
  { code: 'PHP', label: 'PHP — Philippine Peso (₱)' },
]

type BankAccount = { id: string; institutionName: string }

export function SettingsClient({
  theme: savedTheme,
  currency,
  defaultPage,
  alertThreshold,
  budgetStartDay,
  weeklyDigest,
  emailAlerts,
  bankAccounts,
}: {
  theme: string
  currency: string
  defaultPage: string
  alertThreshold: number
  budgetStartDay: number
  weeklyDigest: boolean
  emailAlerts: boolean
  bankAccounts: BankAccount[]
}) {
  const { setTheme, theme: currentTheme } = useTheme()
  const [state, action, pending] = useActionState(updateSettings, undefined)
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (state?.success) toast.success('Settings saved.')
  }, [state])

  function handleDisconnect(id: string, name: string) {
    startTransition(async () => {
      await disconnectAccount(id)
      toast.success(`Disconnected ${name}.`)
    })
  }

  const themeOptions = [
    { value: 'light',  label: 'Light',  Icon: Sun },
    { value: 'dark',   label: 'Dark',   Icon: Moon },
    { value: 'system', label: 'System', Icon: Monitor },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Customize how Ashtronomical looks and behaves</p>
      </div>

      <form action={action} className="space-y-6">
        {/* ── Appearance ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
            <CardDescription>Choose your preferred color theme</CardDescription>
          </CardHeader>
          <CardContent>
            <input type="hidden" name="theme" value={currentTheme ?? savedTheme} />
            <div className="flex gap-3">
              {themeOptions.map(({ value, label, Icon }) => {
                const active = (currentTheme ?? savedTheme) === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    className={`flex-1 flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all ${
                      active ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* ── Budget behavior ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget behavior</CardTitle>
            <CardDescription>Control how your monthly budget is calculated and when you're alerted</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="budgetStartDay">Budget resets on day</Label>
                <p className="text-xs text-muted-foreground">Day of month your budget cycle starts (1–28)</p>
                <Input
                  id="budgetStartDay"
                  name="budgetStartDay"
                  type="number"
                  min="1"
                  max="28"
                  defaultValue={budgetStartDay}
                  className="max-w-24"
                />
                {state?.errors?.budgetStartDay && <p className="text-xs text-destructive">{state.errors.budgetStartDay[0]}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="alertThreshold">Over-budget alert at</Label>
                <p className="text-xs text-muted-foreground">Warn when a category reaches this % of its budget</p>
                <div className="flex items-center gap-2">
                  <Input
                    id="alertThreshold"
                    name="alertThreshold"
                    type="number"
                    min="1"
                    max="100"
                    defaultValue={alertThreshold}
                    className="max-w-24"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                {state?.errors?.alertThreshold && <p className="text-xs text-destructive">{state.errors.alertThreshold[0]}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Display ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Display</CardTitle>
            <CardDescription>Language, currency, and navigation preferences</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  name="currency"
                  defaultValue={currency}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="defaultPage">Default landing page</Label>
                <select
                  id="defaultPage"
                  name="defaultPage"
                  defaultValue={defaultPage}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                >
                  {PAGES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Email notifications ── */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Email notifications</CardTitle>
            <CardDescription>Stay on top of your budget without opening the app</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" name="weeklyDigest" defaultChecked={weeklyDigest} className="h-4 w-4 rounded border mt-0.5" />
              <div>
                <p className="text-sm font-medium">Weekly summary</p>
                <p className="text-xs text-muted-foreground">A recap of your spending, savings rate, and any over-budget categories.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" name="emailAlerts" defaultChecked={emailAlerts} className="h-4 w-4 rounded border mt-0.5" />
              <div>
                <p className="text-sm font-medium">Budget alerts</p>
                <p className="text-xs text-muted-foreground">Get emailed when a category crosses your alert threshold.</p>
              </div>
            </label>
          </CardContent>
        </Card>

        <Button type="submit" disabled={pending} className="w-full sm:w-auto">
          {pending ? 'Saving…' : 'Save settings'}
        </Button>
      </form>

      <Separator />

      {/* ── Data export ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Download className="h-4 w-4" />Export your data
          </CardTitle>
          <CardDescription>Download all your transactions, budgets, categories, and goals as a CSV file</CardDescription>
        </CardHeader>
        <CardContent>
          <a href="/api/export" download>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download export
            </Button>
          </a>
        </CardContent>
      </Card>

      {/* ── Connected accounts ── */}
      {bankAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Landmark className="h-4 w-4" />Connected bank accounts
            </CardTitle>
            <CardDescription>Disconnect an account to stop syncing its transactions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            {bankAccounts.map((acct, i) => (
              <div key={acct.id}>
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                      <Landmark className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium">{acct.institutionName}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive h-8"
                    onClick={() => handleDisconnect(acct.id, acct.institutionName)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Disconnect
                  </Button>
                </div>
                {i < bankAccounts.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
