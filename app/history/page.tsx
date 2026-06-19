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
import { formatMinutes } from '@/lib/datetime'
import { createClient } from '@/lib/supabase/server'

export const metadata = { title: '我的历史日报' }

type ReportRow = {
  id: string
  report_date: string
  done: string
  blockers: string | null
  tomorrow_plan: string | null
  minutes_spent: number | null
  updated_at: string
}

export default async function HistoryPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // RLS already restricts to the caller's rows. The explicit `eq('user_id', …)`
  // is kept for index use and to make intent obvious (see §9 of the spec).
  const { data: reports } = await supabase
    .from('reports')
    .select(
      'id, report_date, done, blockers, tomorrow_plan, minutes_spent, updated_at',
    )
    .eq('user_id', user.id)
    .order('report_date', { ascending: false })

  const rows: ReportRow[] = reports ?? []

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
            {rows.map((r) => (
              <Card key={r.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span>{r.report_date}</span>
                    {r.minutes_spent != null ? (
                      <Badge variant="secondary">
                        {formatMinutes(r.minutes_spent)}
                      </Badge>
                    ) : null}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm">
                  <section>
                    <h3 className="mb-1 font-medium">完成</h3>
                    <p className="whitespace-pre-wrap text-foreground/90">
                      {r.done}
                    </p>
                  </section>
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
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

