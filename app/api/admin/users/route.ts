import { NextResponse, type NextRequest } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// POST /api/admin/users
// Body: { email, password, full_name? }
// Creates a contractor account using the service_role admin API (§9.1).
// Per §14, error responses MUST NOT leak enumerable details (e.g. "email
// already exists") — anything unexpected collapses to a generic message.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 8
const MAX_FULL_NAME_LENGTH = 100

type CreateBody = {
  email?: unknown
  password?: unknown
  full_name?: unknown
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function POST(request: NextRequest) {
  // 1. Session + admin authorization. proxy.ts already gates the route by
  //    `app_metadata.role`, but §14 mandates a server-side `profiles.role`
  //    re-check before any mutation.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '未登录' }, { status: 401 })
  }

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
    return NextResponse.json({ error: '无权限' }, { status: 403 })
  }

  // 2. Parse + validate input.
  let body: CreateBody
  try {
    body = (await request.json()) as CreateBody
  } catch {
    return badRequest('请求格式不正确')
  }

  const email =
    typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const fullNameRaw =
    typeof body.full_name === 'string' ? body.full_name.trim() : ''

  if (!email || !EMAIL_RE.test(email)) {
    return badRequest('请填写有效的邮箱地址')
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return badRequest(`密码至少 ${MIN_PASSWORD_LENGTH} 位`)
  }
  if (fullNameRaw.length > MAX_FULL_NAME_LENGTH) {
    return badRequest('姓名过长')
  }

  // 3. Create the user via the service_role admin client. §9.1 forbids
  //    `signUp()` here — it would replace the caller's session JWT.
  const admin = createAdminClient()
  const { data: created, error: createErr } = await admin.auth.admin.createUser(
    {
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'contractor' },
    },
  )
  if (createErr || !created.user) {
    // Per §14: do not surface details like "User already registered". A
    // generic message prevents account enumeration.
    return NextResponse.json(
      { error: '创建账号失败，请稍后重试' },
      { status: 400 },
    )
  }

  // 4. Optional: populate full_name on the auto-created profiles row
  //    (the auth.users insert trigger from 0001 has already inserted it).
  if (fullNameRaw) {
    await admin
      .from('profiles')
      .update({ full_name: fullNameRaw })
      .eq('id', created.user.id)
  }

  return NextResponse.json({ id: created.user.id }, { status: 201 })
}

