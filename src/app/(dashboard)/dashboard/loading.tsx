import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-8 w-40" />
      </div>

      {/* Financial health row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <Card key={i}><CardContent className="pt-5 flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-3 w-32" />
            </div>
          </CardContent></Card>
        ))}
      </div>

      {/* Chart + ring */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card className="md:col-span-3"><CardContent className="pt-6"><Skeleton className="h-56 w-full" /></CardContent></Card>
        <Card className="md:col-span-2"><CardContent className="pt-6 flex flex-col items-center gap-4">
          <Skeleton className="h-32 w-32 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </CardContent></Card>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
        <Card><CardContent className="pt-6 space-y-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
        </CardContent></Card>
      </div>
    </div>
  )
}
