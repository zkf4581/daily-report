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
import { formatMinutes, todayInTimeZone } from '@/lib/datetime'
import { createClient } from '@/lib/supabase/server'

import { saveTodayReport } from './actions'
import { TodayToast } from './today-toast'

export const metadata = { title: '今日日报' }

const DEFAULT_TZ = 'Asia/Shanghai'

type SearchParams = Promise<{
  error?: string | string[]
  saved?: string | string[]
}>

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

  const { data: existing } = await supabase
    .from('reports')
    .select('done, blockers, tomorrow_plan, minutes_spent, updated_at')
    .eq('user_id', user.id)
    .eq('report_date', reportDate)
    .maybeSingle()

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
              当天可反复保存；过了今天就自动锁定为只读历史。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={saveTodayReport} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <Label htmlFor="done">今天完成了什么 *</Label>
                <Textarea
                  id="done"
                  name="done"
                  required
                  minLength={1}
                  rows={5}
                  defaultValue={existing?.done ?? ''}
                  placeholder="必填，简要列出今日完成的工作"
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
              <div className="flex flex-col gap-2">
                <Label htmlFor="minutes_spent">耗时（分钟，选填）</Label>
                <Input
                  id="minutes_spent"
                  name="minutes_spent"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  defaultValue={existing?.minutes_spent ?? ''}
                  placeholder="例如 480 = 8 小时"
                />
                {existing?.minutes_spent != null ? (
                  <p className="text-xs text-muted-foreground">
                    当前：{formatMinutes(existing.minutes_spent)}
                  </p>
                ) : null}
              </div>

              {errorCode === 'done' ? (
                <p role="alert" className="text-sm text-destructive">
                  「今天完成了什么」是必填项。
                </p>
              ) : null}
              {errorCode === 'minutes' ? (
                <p role="alert" className="text-sm text-destructive">
                  耗时必须是大于等于 0 的整数（分钟）。
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
    </main>
  )
}

