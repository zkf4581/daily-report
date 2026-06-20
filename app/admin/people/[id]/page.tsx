import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { LogoutButton } from '@/components/logout-button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  startOfMonthInTimeZone,
  startOfWeekInTimeZone,
  todayInTimeZone,
} from '@/lib/datetime'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: '管理员 · 外包历史' }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const DEFAULT_TZ = 'Asia/Shanghai'

type SearchParams = Promise<{
  from?: string | string[]
  to?: string | string[]
}>

type ReportRow = {
  id: string
  report_date: string
  done: string | null
  blockers: string | null
  tomorrow_plan: string | null
  updated_at: string
}

type ProfileRow = {
  id: string
  email: string
  full_name: string | null
  timezone: string
  is_active: boolean
  role: string
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

function pick(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? ''
  return v ?? ''
}

function toNum(v: string | number): number {
  return typeof v === 'number' ? v : Number(v)
}

function formatValue(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return Number.isInteger(v) ? String(v) : String(parseFloat(v.toFixed(4)))
}

function sumInRange(
  metrics: MetricRow[],
  items: MetricItemRow[],
  from: string,
  to: string,
): { itemId: string; name: string; unit: string; total: number }[] {
  const totals = new Map<string, number>()
  for (const m of metrics) {
    if (m.report_date < from || m.report_date > to) continue
    const n = toNum(m.value)
    if (!Number.isFinite(n)) continue
    totals.set(m.metric_item_id, (totals.get(m.metric_item_id) ?? 0) + n)
  }
  // Return one row per known item (sorted), plus any unknown-id totals at end.
  const itemById = new Map(items.map((i) => [i.id, i]))
  const rows = items
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => ({
      itemId: i.id,
      name: i.name,
      unit: i.unit,
      total: totals.get(i.id) ?? 0,
    }))
  for (const [id, total] of totals) {
    if (!itemById.has(id)) {
      rows.push({ itemId: id, name: '未知项', unit: '', total })
    }
  }
  return rows
}

function countDaysInRange(
  reports: { report_date: string }[],
  from: string,
  to: string,
): number {
  const days = new Set<string>()
  for (const r of reports) {
    if (r.report_date >= from && r.report_date <= to) days.add(r.report_date)
  }
  return days.size
}

export default async function AdminPersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: SearchParams
}) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS (is_admin) bounds the result to admins; the explicit id filter both
  // narrows the read and uses the primary-key index.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, full_name, timezone, is_active, role')
    .eq('id', id)
    .maybeSingle<ProfileRow>()
  if (!profile) notFound()

  const tz = profile.timezone || DEFAULT_TZ
  const today = todayInTimeZone(tz)
  const weekStart = startOfWeekInTimeZone(tz)
  const monthStart = startOfMonthInTimeZone(tz)

  const sp = await searchParams
  const fromRaw = pick(sp.from)
  const toRaw = pick(sp.to)
  const customFrom = DATE_RE.test(fromRaw) ? fromRaw : monthStart
  const customTo = DATE_RE.test(toRaw) ? toRaw : today
  // Defensive swap if user inverted the range.
  const rangeFrom = customFrom <= customTo ? customFrom : customTo
  const rangeTo = customFrom <= customTo ? customTo : customFrom

  // One wide fetch covers all three ranges; we filter & aggregate client-side.
  const widestFrom = [weekStart, monthStart, rangeFrom].sort()[0]
  const widestTo = [today, rangeTo].sort()[1] ?? today

  const [reportsRes, metricsRes, itemsRes] = await Promise.all([
    supabase
      .from('reports')
      .select('id, report_date, done, blockers, tomorrow_plan, updated_at')
      .eq('user_id', id)
      .order('report_date', { ascending: false }),
    supabase
      .from('report_metrics')
      .select('report_date, metric_item_id, value')
      .eq('user_id', id)
      .gte('report_date', widestFrom)
      .lte('report_date', widestTo),
    // Pull all items (active + inactive) so historical references still resolve
    // to a name/unit even after the admin disables an item.
    supabase
      .from('metric_items')
      .select('id, name, unit, sort_order')
      .order('sort_order', { ascending: true }),
  ])

  const rows: ReportRow[] = reportsRes.data ?? []
  const metrics: MetricRow[] = metricsRes.data ?? []
  const items: MetricItemRow[] = itemsRes.data ?? []
  const itemById = new Map(items.map((i) => [i.id, i]))

  const weekSums = sumInRange(metrics, items, weekStart, today)
  const monthSums = sumInRange(metrics, items, monthStart, today)
  const rangeSums = sumInRange(metrics, items, rangeFrom, rangeTo)
  const weekDays = countDaysInRange(rows, weekStart, today)
  const monthDays = countDaysInRange(rows, monthStart, today)
  const rangeDays = countDaysInRange(rows, rangeFrom, rangeTo)

  // Per-day metric badges, grouped by report_date for the timeline below.
  const metricsByDate = new Map<string, MetricRow[]>()
  for (const m of metrics) {
    const list = metricsByDate.get(m.report_date) ?? []
    list.push(m)
    metricsByDate.set(m.report_date, list)
  }
  for (const list of metricsByDate.values()) {
    list.sort((a, b) => {
      const oa = itemById.get(a.metric_item_id)?.sort_order ?? 9999
      const ob = itemById.get(b.metric_item_id)?.sort_order ?? 9999
      return oa - ob
    })
  }

  const displayName = profile.full_name || profile.email
  const isContractor = profile.role === 'contractor'

  return (
    <main className="flex flex-1 justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">{displayName} 的历史日报</h1>
            <p className="text-sm text-muted-foreground">
              {profile.email} · {tz}
              {profile.is_active ? '' : ' · 已停用'}
              {isContractor ? '' : ` · 角色：${profile.role}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="text-sm underline underline-offset-4"
            >
              ← 返回总览
            </Link>
            <Link
              href="/admin/metrics"
              className="text-sm underline underline-offset-4"
            >
              统计项配置
            </Link>
            <LogoutButton />
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>统计项汇总</CardTitle>
            <CardDescription>
              基于该外包时区（{tz}）的本周（周一起）/ 本月 / 自选区间合计。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <SummaryCard
                title="本周"
                range={`${weekStart} ~ ${today}`}
                days={weekDays}
                sums={weekSums}
              />
              <SummaryCard
                title="本月"
                range={`${monthStart} ~ ${today}`}
                days={monthDays}
                sums={monthSums}
              />
              <SummaryCard
                title="自选区间"
                range={`${rangeFrom} ~ ${rangeTo}`}
                days={rangeDays}
                sums={rangeSums}
              />
            </div>
            <form
              method="get"
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
            >
              <div className="flex flex-col gap-1.5">
                <label htmlFor="from" className="text-xs text-muted-foreground">
                  起
                </label>
                <input
                  id="from"
                  name="from"
                  type="date"
                  defaultValue={rangeFrom}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="to" className="text-xs text-muted-foreground">
                  止
                </label>
                <input
                  id="to"
                  name="to"
                  type="date"
                  defaultValue={rangeTo}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
                >
                  应用
                </button>
                <Link
                  href={`/admin/people/${id}`}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-input px-4 text-sm font-medium shadow-xs hover:bg-accent"
                >
                  重置
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>

        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              该外包还没有任何日报。
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
                                {name}：{formatValue(toNum(m.value))} {unit}
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

function SummaryCard({
  title,
  range,
  days,
  sums,
}: {
  title: string
  range: string
  days: number
  sums: { itemId: string; name: string; unit: string; total: number }[]
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">提交 {days} 天</span>
      </div>
      <p className="text-xs text-muted-foreground">{range}</p>
      {sums.length === 0 ? (
        <p className="text-xs text-muted-foreground">暂无统计项。</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {sums.map((s) => (
            <li key={s.itemId} className="flex items-center justify-between">
              <span>{s.name}</span>
              <span className="font-medium">
                {formatValue(s.total)} {s.unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

