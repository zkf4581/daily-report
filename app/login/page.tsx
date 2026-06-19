import { redirect } from 'next/navigation'

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
import { createClient } from '@/lib/supabase/server'

import { signIn } from './actions'
import { LoginErrorToast } from './login-error-toast'

export const metadata = {
  title: '登录',
}

type SearchParams = Promise<{ error?: string | string[] }>

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const role = (user.app_metadata as { role?: unknown } | null)?.role
    redirect(role === 'admin' ? '/admin' : '/today')
  }

  const { error } = await searchParams
  const errorCode = Array.isArray(error) ? error[0] : error

  return (
    <main className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>登录</CardTitle>
          <CardDescription>用邮箱和密码登录日报系统</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={signIn} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={1}
              />
            </div>
            {errorCode ? (
              <p
                role="alert"
                className="text-sm text-destructive"
                data-testid="login-error"
              >
                邮箱或密码不正确
              </p>
            ) : null}
            <Button type="submit" className="w-full">
              登录
            </Button>
          </form>
        </CardContent>
      </Card>
      <LoginErrorToast error={errorCode} />
    </main>
  )
}

