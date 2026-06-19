'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'

// Bridges a `?error=...` search param on /login into a sonner toast. Stays
// generic per §14 — we never disclose whether the email was unknown vs the
// password was wrong.
export function LoginErrorToast({ error }: { error?: string }) {
  useEffect(() => {
    if (error) {
      toast.error('邮箱或密码不正确')
    }
  }, [error])
  return null
}

