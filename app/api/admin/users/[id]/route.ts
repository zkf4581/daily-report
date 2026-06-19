import { NextResponse, type NextRequest } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/admin/users/[id]
// Body shapes:
//   { action: 'deactivate' }
//   { action: 'activate' }
//   { action: 'reset_password', password: string }
//
// All actions require an authenticated admin caller (re-checked against
// profiles.role per §14) and use the service_role admin API (§9.1).

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MIN_PASSWORD_LENGTH = 8
// 100 years — effectively a permanent ban for stopped contractors.
const BAN_FOREVER = '876000h'
const BAN_NONE = 'none'

type PatchBody = {
  action?: unknown
  password?: unknown
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  // Next 16: params is a Promise — must await (§5).
  const { id } = await context.params
  if (!UUID_RE.test(id)) {
    return badRequest('无效的用户 ID')
  }

  // 1. Session + admin authorization (mirrors POST route).
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

  // 2. Parse body.
  let body: PatchBody
  try {
    body = (await request.json()) as PatchBody
  } catch {
    return badRequest('请求格式不正确')
  }
  const action = body.action

  const admin = createAdminClient()

  if (action === 'deactivate' || action === 'activate') {
    const nextActive = action === 'activate'
    // Update both profiles.is_active (the RLS source of truth) and the
    // auth-level ban so the user cannot exchange refresh tokens for new
    // sessions while deactivated (§9.1).
    const { error: profileErr } = await admin
      .from('profiles')
      .update({ is_active: nextActive })
      .eq('id', id)
    if (profileErr) {
      return NextResponse.json(
        { error: '更新失败，请稍后重试' },
        { status: 400 },
      )
    }
    const { error: authErr } = await admin.auth.admin.updateUserById(id, {
      ban_duration: nextActive ? BAN_NONE : BAN_FOREVER,
    })
    if (authErr) {
      return NextResponse.json(
        { error: '更新失败，请稍后重试' },
        { status: 400 },
      )
    }
    return NextResponse.json({ ok: true, is_active: nextActive })
  }

  if (action === 'reset_password') {
    const password = typeof body.password === 'string' ? body.password : ''
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      return badRequest(`密码至少 ${MIN_PASSWORD_LENGTH} 位`)
    }
    const { error: authErr } = await admin.auth.admin.updateUserById(id, {
      password,
    })
    if (authErr) {
      // Generic message — avoid leaking whether the target user exists (§14).
      return NextResponse.json(
        { error: '重置密码失败，请稍后重试' },
        { status: 400 },
      )
    }
    return NextResponse.json({ ok: true })
  }

  return badRequest('未知操作')
}

