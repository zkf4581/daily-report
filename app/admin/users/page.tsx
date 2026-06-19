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

import { CreateUserDialog } from './create-user-dialog'
import { UsersTable, type ContractorRow } from './users-table'

export const metadata = { title: '管理员 · 账号管理' }

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Server-side admin re-check on top of proxy.ts (§14: don't trust the
  // proxy alone for sensitive surfaces).
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

  // RLS (is_admin) already constrains cross-user reads; the explicit
  // role='contractor' filter narrows the result and matches the page intent.
  const { data: contractors } = await supabase
    .from('profiles')
    .select('id, email, full_name, is_active, created_at')
    .eq('role', 'contractor')
    .order('created_at', { ascending: false })
  const rows: ContractorRow[] = contractors ?? []

  return (
    <main className="flex flex-1 justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="flex w-full max-w-4xl flex-col gap-6">
        <header className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">账号管理</h1>
            <p className="text-sm text-muted-foreground">
              创建、停用 / 启用、重置外包账号。
            </p>
          </div>
          <LogoutButton />
        </header>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>外包账号</CardTitle>
              <CardDescription>共 {rows.length} 个账号。</CardDescription>
            </div>
            <CreateUserDialog />
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
                还没有外包账号。点击右上角「创建账号」开始。
              </p>
            ) : (
              <UsersTable rows={rows} />
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

