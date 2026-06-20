import Link from 'next/link'
import { redirect } from 'next/navigation'

import { LogoutButton } from '@/components/logout-button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: '我的历史日报' }

type ReportRow = {
  id: string
  report_date: string
  done: string | null
  blockers: string | null
  tomorrow_plan: string | null
  updated_at: string
}

type MetricRow = {
  report_date: string
  metric_item_id: string
  value: string | number
}

type MetricItemRow = {
  id: string
  name: string
  unit: string
  sort_order: number
}

function formatValue(v: string | number): string {
  // numeric arrives as string from PostgREST; Number() handles both.
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return String(v)
  // Trim trailing zeros but keep up to a sensible precision for decimals.
  return Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(4)))
}

export default async function HistoryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS already restricts to the caller's rows. Explicit `eq('user_id', …)`
  // is kept for index use and to make intent obvious (see §9 of the spec).
  const [reportsRes, metricsRes, itemsRes] = await Promise.all([
    supabase
      .from('reports')
      .select('id, report_date, done, blockers, tomorrow_plan, updated_at')
      .eq('user_id', user.id)
      .order('report_date', { ascending: false }),
    supabase
      .from('report_metrics')
      .select('report_date, metric_item_id, value')
      .eq('user_id', user.id),
    // Include inactive items too — historical rows may reference items that
    // have since been disabled, and we still want their name/unit shown.
    supabase.from('metric_items').select('id, name, unit, sort_order'),
  ])

  const rows: ReportRow[] = reportsRes.data ?? []
  const items: MetricItemRow[] = itemsRes.data ?? []
  const itemById = new Map(items.map((i) => [i.id, i]))

  const metricsByDate = new Map<string, MetricRow[]>()
  for (const m of (metricsRes.data ?? []) as MetricRow[]) {
    const list = metricsByDate.get(m.report_date) ?? []
    list.push(m)
    metricsByDate.set(m.report_date, list)
  }
  // Sort each day's metrics by the item's sort_order so display order is stable.
  for (const list of metricsByDate.values()) {
    list.sort((a, b) => {
      const oa = itemById.get(a.metric_item_id)?.sort_order ?? 9999
      const ob = itemById.get(b.metric_item_id)?.sort_order ?? 9999
      return oa - ob
    })
  }

  return (
    <main className="flex flex-1 justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">我的历史日报</h1>
            <p className="text-sm text-muted-foreground">
              只读时间线，倒序排列。过去日期不可再编辑。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/today"
              className="text-sm underline underline-offset-4"
            >
              今日日报
            </Link>
            <LogoutButton />
          </div>
        </header>

        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              还没有任何日报。先去{' '}
              <Link href="/today" className="underline underline-offset-4">
                填今天的
              </Link>
              。
            </CardContent>
          </Card>
        ) : (
          <div className="flex flex-col gap-4">
            {rows.map((r) => {
              const dayMetrics = metricsByDate.get(r.report_date) ?? []
              return (
                <Card key={r.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span>{r.report_date}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 text-sm">
                    {dayMetrics.length > 0 ? (
                      <section>
                        <h3 className="mb-1 font-medium">数据</h3>
                        <div className="flex flex-wrap gap-2">
                          {dayMetrics.map((m) => {
                            const it = itemById.get(m.metric_item_id)
                            const name = it?.name ?? '未知项'
                            const unit = it?.unit ?? ''
                            return (
                              <Badge key={m.metric_item_id} variant="secondary">
                                {name}：{formatValue(m.value)} {unit}
                              </Badge>
                            )
                          })}
                        </div>
                      </section>
                    ) : null}
                    {r.done ? (
                      <section>
                        <h3 className="mb-1 font-medium">完成</h3>
                        <p className="whitespace-pre-wrap text-foreground/90">
                          {r.done}
                        </p>
                      </section>
                    ) : null}
                    {r.blockers ? (
                      <section>
                        <h3 className="mb-1 font-medium">阻塞</h3>
                        <p className="whitespace-pre-wrap text-foreground/90">
                          {r.blockers}
                        </p>
                      </section>
                    ) : null}
                    {r.tomorrow_plan ? (
                      <section>
                        <h3 className="mb-1 font-medium">明天计划</h3>
                        <p className="whitespace-pre-wrap text-foreground/90">
                          {r.tomorrow_plan}
                        </p>
                      </section>
                    ) : null}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}

