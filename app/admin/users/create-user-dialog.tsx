'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Client wrapper for the "create contractor" Dialog. Posts to POST
// /api/admin/users which performs the service_role create. Validation here
// is purely UX — the route handler re-validates per §14.
const MIN_PASSWORD_LENGTH = 8

export function CreateUserDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [pending, startTransition] = useTransition()

  function reset() {
    setEmail('')
    setPassword('')
    setFullName('')
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    startTransition(async () => {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          full_name: fullName.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        toast.error(data?.error ?? '创建账号失败，请稍后重试')
        return
      }
      toast.success('账号已创建')
      reset()
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">创建账号</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>创建外包账号</DialogTitle>
          <DialogDescription>
            邮箱与初始密码会直接生效，外包可立即登录。
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-email">邮箱</Label>
            <Input
              id="new-email"
              type="email"
              autoComplete="off"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contractor@example.com"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-password">初始密码</Label>
            <Input
              id="new-password"
              type="text"
              autoComplete="off"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`至少 ${MIN_PASSWORD_LENGTH} 位`}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-full-name">姓名（可选）</Label>
            <Input
              id="new-full-name"
              type="text"
              autoComplete="off"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="展示用，可留空"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                取消
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? '创建中…' : '创建'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

