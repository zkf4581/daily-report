import Link from 'next/link'
import { redirect } from 'next/navigation'

import { LogoutButton } from '@/components/logout-button'
import { Badge } from '@/components/ui/badge'
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
import { Textarea } from '@/components/ui/textarea'
import { todayInTimeZone } from '@/lib/datetime'
import { createClient } from '@/lib/supabase/server'

import { saveTodayReport } from './actions'
import { TodayConfetti } from './today-confetti'
import { TodayToast } from './today-toast'

export const metadata = { title: '今日日报' }

const DEFAULT_TZ = 'Asia/Shanghai'

type SearchParams = Promise<{
  error?: string | string[]
  saved?: string | string[]
}>

type MetricItem = {
  id: string
  name: string
  unit: string
  sort_order: number
}

type MetricValue = { metric_item_id: string; value: string | number }

export default async function TodayPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, timezone')
    .eq('id', user.id)
    .single()
  const timezone = profile?.timezone || DEFAULT_TZ
  const reportDate = todayInTimeZone(timezone)

  const [existingRes, itemsRes, metricsRes] = await Promise.all([
    supabase
      .from('reports')
      .select('done, blockers, tomorrow_plan, updated_at')
      .eq('user_id', user.id)
      .eq('report_date', reportDate)
      .maybeSingle(),
    supabase
      .from('metric_items')
      .select('id, name, unit, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('report_metrics')
      .select('metric_item_id, value')
      .eq('user_id', user.id)
      .eq('report_date', reportDate),
  ])
  const existing = existingRes.data
  const items: MetricItem[] = itemsRes.data ?? []
  const valuesByItem = new Map<string, string>()
  for (const m of (metricsRes.data ?? []) as MetricValue[]) {
    // PostgREST returns numeric as string to preserve precision; keep as string
    // for safe round-tripping into <input type=number defaultValue>.
    valuesByItem.set(m.metric_item_id, String(m.value))
  }

  const { error, saved } = await searchParams
  const errorCode = Array.isArray(error) ? error[0] : error
  const savedCode = Array.isArray(saved) ? saved[0] : saved
  const displayName = profile?.full_name || profile?.email || user.email

  return (
    <main className="flex flex-1 justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="flex w-full max-w-2xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">今日日报</h1>
            <p className="text-sm text-muted-foreground">
              {displayName} · {timezone} · {reportDate}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/history"
              className="text-sm underline underline-offset-4"
            >
              我的历史
            </Link>
            <LogoutButton />
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>{reportDate} 的日报</span>
              {existing ? (
                <Badge variant="secondary">已提交，可继续编辑</Badge>
              ) : (
                <Badge variant="outline">未提交</Badge>
              )}
            </CardTitle>
            <CardDescription>
              当天可反复保存；过了今天就自动锁定为只读历史。至少填写一项（完成情况或任一统计项）。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveTodayReport} className="flex flex-col gap-5">
              {items.length > 0 ? (
                <fieldset className="flex flex-col gap-3 rounded-md border p-4">
                  <legend className="px-1 text-sm font-medium">
                    今日数据（选填，可留空）
                  </legend>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {items.map((it) => {
                      const inputId = `metric_${it.id}`
                      return (
                        <div key={it.id} className="flex flex-col gap-1.5">
                          <Label htmlFor={inputId}>
                            {it.name}
                            <span className="ml-1 text-xs font-normal text-muted-foreground">
                              ({it.unit})
                            </span>
                          </Label>
                          <Input
                            id={inputId}
                            name={inputId}
                            type="number"
                            min={0}
                            step="any"
                            inputMode="decimal"
                            defaultValue={valuesByItem.get(it.id) ?? ''}
                            placeholder="留空表示未做"
                          />
                        </div>
                      )
                    })}
                  </div>
                </fieldset>
              ) : (
                <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  当前没有启用的统计项；可仅填写下方文字内容。
                </p>
              )}

              <div className="flex flex-col gap-2">
                <Label htmlFor="done">今天完成了什么</Label>
                <Textarea
                  id="done"
                  name="done"
                  rows={5}
                  defaultValue={existing?.done ?? ''}
                  placeholder="选填，简要列出今日完成的工作"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="blockers">遇到的阻塞 / 问题</Label>
                <Textarea
                  id="blockers"
                  name="blockers"
                  rows={3}
                  defaultValue={existing?.blockers ?? ''}
                  placeholder="选填"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="tomorrow_plan">明天计划</Label>
                <Textarea
                  id="tomorrow_plan"
                  name="tomorrow_plan"
                  rows={3}
                  defaultValue={existing?.tomorrow_plan ?? ''}
                  placeholder="选填"
                />
              </div>

              {errorCode === 'empty' ? (
                <p role="alert" className="text-sm text-destructive">
                  请至少填写一项（完成情况或任一统计项）。
                </p>
              ) : null}
              {errorCode === 'metric' ? (
                <p role="alert" className="text-sm text-destructive">
                  统计项填写有误：请输入大于等于 0 的有限数（可含小数）。
                </p>
              ) : null}
              {errorCode === 'save' ? (
                <p role="alert" className="text-sm text-destructive">
                  保存失败，请稍后再试。
                </p>
              ) : null}

              <Button type="submit" className="w-full">
                保存
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <TodayToast error={errorCode} saved={savedCode} />
      <TodayConfetti saved={savedCode} />
    </main>
  )
}

