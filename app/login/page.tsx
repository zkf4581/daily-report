import { redirect } from 'next/navigation'

import { AnimatedGradientText } from '@/components/magicui/animated-gradient-text'
import { BorderBeam } from '@/components/magicui/border-beam'
import { DotPattern } from '@/components/magicui/dot-pattern'
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
import { cn } from '@/lib/utils'
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
    <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-zinc-50 px-4 py-16 dark:bg-black">
      <DotPattern
        glow
        className={cn(
          'absolute inset-0 -z-10 text-zinc-400/50 dark:text-zinc-600/40',
          '[mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]',
          'motion-reduce:hidden',
        )}
      />
      <DotPattern
        className={cn(
          'absolute inset-0 -z-10 hidden text-zinc-400/40 dark:text-zinc-600/30',
          '[mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]',
          'motion-reduce:block',
        )}
      />
      <Card className="relative w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            <AnimatedGradientText
              className="text-base font-medium motion-reduce:animate-none"
              colorFrom="#6366f1"
              colorTo="#ec4899"
            >
              登录
            </AnimatedGradientText>
          </CardTitle>
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
        <BorderBeam
          duration={8}
          size={120}
          colorFrom="#6366f1"
          colorTo="#ec4899"
          className="motion-reduce:hidden"
        />
      </Card>
      <LoginErrorToast error={errorCode} />
    </main>
  )
}

