'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const MIN_PASSWORD_LENGTH = 8

// Reset-password confirmation surface. Controlled by the parent UsersTable —
// it owns the `open` state so each row can drive its own dialog without
// nested triggers. Posts the new password to PATCH /api/admin/users/[id].
export function ResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  userLabel,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userLabel: string
}) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [pending, startTransition] = useTransition()

  function handleClose(o: boolean) {
    onOpenChange(o)
    if (!o) setPassword('')
  }

  async function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (pending) return
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`密码至少 ${MIN_PASSWORD_LENGTH} 位`)
      return
    }
    startTransition(async () => {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset_password',
          password,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string
        } | null
        toast.error(data?.error ?? '重置密码失败，请稍后重试')
        return
      }
      toast.success('密码已重置')
      setPassword('')
      onOpenChange(false)
      router.refresh()
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>重置密码</AlertDialogTitle>
          <AlertDialogDescription>
            为 {userLabel} 设置新的初始密码。请手动告知该外包。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form onSubmit={handleConfirm} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`reset-password-${userId}`}>新密码</Label>
            <Input
              id={`reset-password-${userId}`}
              type="text"
              autoComplete="off"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={`至少 ${MIN_PASSWORD_LENGTH} 位`}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
            <Button type="submit" disabled={pending}>
              {pending ? '重置中…' : '确认重置'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}

