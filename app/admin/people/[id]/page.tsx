import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

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

export const metadata = { title: '管理员 · 外包历史' }

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type ReportRow = {
  id: string
  report_date: string
  done: string
  blockers: string | null
  tomorrow_plan: string | null
  minutes_spent: number | null
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

export default async function AdminPersonPage({
  params,
}: {
  params: Promise<{ id: string }>
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

  const { data: reports } = await supabase
    .from('reports')
    .select(
      'id, report_date, done, blockers, tomorrow_plan, minutes_spent, updated_at',
    )
    .eq('user_id', id)
    .order('report_date', { ascending: false })
  const rows: ReportRow[] = reports ?? []

  const displayName = profile.full_name || profile.email
  const isContractor = profile.role === 'contractor'

  return (
    <main className="flex flex-1 justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">{displayName} 的历史日报</h1>
            <p className="text-sm text-muted-foreground">
              {profile.email} · {profile.timezone}
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
            <LogoutButton />
          </div>
        </header>

        {rows.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              该外包还没有任何日报。
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

