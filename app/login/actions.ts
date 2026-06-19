'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Generic error code surfaced to the login page. Per §14 we MUST NOT distinguish
// "email not found" from "wrong password" — that would let attackers enumerate
// accounts. Any auth failure or missing input collapses to the same code.
const LOGIN_ERROR_REDIRECT = '/login?error=invalid'

function pickHomeForRole(role: unknown): string {
  return role === 'admin' ? '/admin' : '/today'
}

export async function signIn(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!email || !password) {
    redirect(LOGIN_ERROR_REDIRECT)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.user) {
    redirect(LOGIN_ERROR_REDIRECT)
  }

  const role = (data.user.app_metadata as { role?: unknown } | null)?.role
  redirect(pickHomeForRole(role))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

