import Link from 'next/link'
import { redirect } from 'next/navigation'

import { LogoutButton } from '@/components/logout-button'
import { SubmissionStatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatMinutes, todayInTimeZone } from '@/lib/datetime'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: '管理员 · 今日提交状态' }

const DEFAULT_TZ = 'Asia/Shanghai'
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type SearchParams = Promise<{
  date?: string | string[]
  user?: string | string[]
}>

type Contractor = {
  id: string
  email: string
  full_name: string | null
  timezone: string
}

type ReportRow = {
  user_id: string
  done: string
  blockers: string | null
  tomorrow_plan: string | null
  minutes_spent: number | null
  updated_at: string
}

function pickParam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? ''
  return v ?? ''
}

function truncate(s: string, max = 80): string {
  if (s.length <= max) return s
  return s.slice(0, max).trimEnd() + '…'
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // The admin's own timezone defines what "today" means in the overview.
  // RLS (`is_admin()`) is the real gate for cross-user reads below.
  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('full_name, email, timezone, role')
    .eq('id', user.id)
    .single()
  const adminTz = adminProfile?.timezone || DEFAULT_TZ
  const today = todayInTimeZone(adminTz)

  const params = await searchParams
  const rawDate = pickParam(params.date)
  const selectedDate = DATE_RE.test(rawDate) ? rawDate : today
  const selectedUser = pickParam(params.user)

  // All active contractors (the universe of "who should have submitted").
  const { data: contractors } = await supabase
    .from('profiles')
    .select('id, email, full_name, timezone')
    .eq('role', 'contractor')
    .eq('is_active', true)
    .order('full_name', { ascending: true, nullsFirst: false })
    .order('email', { ascending: true })
  const allContractors: Contractor[] = contractors ?? []

  // Reports for the selected date. With RLS `is_admin()`, the admin sees all
  // rows; the explicit `eq('report_date', …)` uses the (report_date) index.
  const { data: reports } = await supabase
    .from('reports')
    .select('user_id, done, blockers, tomorrow_plan, minutes_spent, updated_at')
    .eq('report_date', selectedDate)
  const reportsByUser = new Map<string, ReportRow>()
  for (const r of (reports ?? []) as ReportRow[]) reportsByUser.set(r.user_id, r)

  const filtered = selectedUser
    ? allContractors.filter((c) => c.id === selectedUser)
    : allContractors
  const submittedCount = allContractors.reduce(
    (n, c) => n + (reportsByUser.has(c.id) ? 1 : 0),
    0,
  )

  const displayName =
    adminProfile?.full_name || adminProfile?.email || user.email
  const isToday = selectedDate === today

  return (
    <main className="flex flex-1 justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="flex w-full max-w-5xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">今日提交状态</h1>
            <p className="text-sm text-muted-foreground">
              {displayName} · {adminTz} · 今天 {today}
            </p>
          </div>
          <LogoutButton />
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <span>{selectedDate}</span>
              {isToday ? null : (
                <span className="text-xs font-normal text-muted-foreground">
                  （历史查询）
                </span>
              )}
            </CardTitle>
            <CardDescription>
              已提交 {submittedCount} / {allContractors.length} 人。
              绿色=已交，红色=未交。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <form
              method="get"
              action="/admin"
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="date">日期</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  defaultValue={selectedDate}
                  className="sm:w-44"
                />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="user">外包人员</Label>
                <select
                  id="user"
                  name="user"
                  defaultValue={selectedUser}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:max-w-xs"
                >
                  <option value="">全部</option>
                  {allContractors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name || c.email}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button type="submit">应用</Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/admin">重置</Link>
                </Button>
              </div>
            </form>

            {allContractors.length === 0 ? (
              <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                暂无启用的外包人员。
              </p>
            ) : filtered.length === 0 ? (
              <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                没有匹配的人员。
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>姓名 / 邮箱</TableHead>
                    <TableHead className="w-24">状态</TableHead>
                    <TableHead>摘要</TableHead>
                    <TableHead className="w-24">耗时</TableHead>
                    <TableHead className="w-24 text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const r = reportsByUser.get(c.id)
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {c.full_name || c.email}
                            </span>
                            {c.full_name ? (
                              <span className="text-xs text-muted-foreground">
                                {c.email}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <SubmissionStatusBadge submitted={Boolean(r)} />
                        </TableCell>
                        <TableCell className="max-w-md text-sm text-foreground/80">
                          {r ? (
                            <span className="line-clamp-2 whitespace-pre-wrap break-words">
                              {truncate(r.done, 160)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {r ? formatMinutes(r.minutes_spent) : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/admin/people/${c.id}`}
                            className="text-sm underline underline-offset-4"
                          >
                            历史
                          </Link>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

