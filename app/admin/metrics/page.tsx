import { redirect } from 'next/navigation'

import { LogoutButton } from '@/components/logout-button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

import { CreateMetricItemDialog } from './create-item-dialog'
import { MetricsTable, type MetricItemRow } from './metrics-table'

export const metadata = { title: '管理员 · 统计项配置' }

export default async function AdminMetricsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Server-side admin re-check on top of proxy.ts (§14 — never trust the proxy
  // alone for sensitive surfaces).
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()
  if (
    !callerProfile ||
    callerProfile.role !== 'admin' ||
    !callerProfile.is_active
  ) {
    redirect('/today')
  }

  // All items (active + inactive), sorted by the admin-defined order then
  // creation time. RLS allows SELECT to any authenticated user — admin gate
  // above just controls who can reach this page.
  const { data: items } = await supabase
    .from('metric_items')
    .select('id, name, unit, sort_order, is_active, created_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  const rows: MetricItemRow[] = items ?? []

  return (
    <main className="flex flex-1 justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="flex w-full max-w-4xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">统计项配置</h1>
            <p className="text-sm text-muted-foreground">
              新增 / 编辑 / 停用统计项；停用项不再出现在外包填写表单，已填写的历史数据保留。
            </p>
          </div>
          <LogoutButton />
        </header>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>统计项</CardTitle>
              <CardDescription>共 {rows.length} 项。</CardDescription>
            </div>
            <CreateMetricItemDialog />
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                还没有统计项。点击右上角「新增统计项」开始。
              </p>
            ) : (
              <MetricsTable rows={rows} />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

