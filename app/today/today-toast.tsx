'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

// Bridges `?error=…` / `?saved=1` query params on /today into sonner toasts.
// Mirrors the pattern used by /login (login-error-toast.tsx) so behaviour and
// copy stay consistent. Messages are friendly and do not leak DB details
// (see §14).
const ERROR_MESSAGES: Record<string, string> = {
  done: '「今天完成了什么」是必填项',
  minutes: '耗时必须是大于等于 0 的整数（分钟）',
  save: '保存失败，请稍后再试',
}

export function TodayToast({
  error,
  saved,
}: {
  error?: string
  saved?: string
}) {
  useEffect(() => {
    if (error && ERROR_MESSAGES[error]) {
      toast.error(ERROR_MESSAGES[error])
    } else if (saved) {
      toast.success('日报已保存')
    }
  }, [error, saved])
  return null
}

