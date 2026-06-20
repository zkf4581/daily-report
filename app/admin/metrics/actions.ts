'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

// Server Actions for /admin/metrics. All mutations:
//   1. require an authenticated session, then
//   2. re-check `profiles.role === 'admin'` (§14 — never trust proxy alone), and
//   3. write through the regular server client; metric_items RLS already
//      restricts INSERT/UPDATE/DELETE to is_admin(), so service_role is not
//      required (and not allowed in client-reachable code paths anyway).

const MAX_NAME_LENGTH = 50
const MAX_UNIT_LENGTH = 20
const MAX_SORT_ORDER = 10_000

export type ActionResult = { ok: true } | { ok: false; error: string }

async function requireAdmin(): Promise<
  | { ok: true; supabase: Awaited<ReturnType<typeof createClient>> }
  | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: '未登录' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_active')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin' || !profile.is_active) {
    return { ok: false, error: '无权限' }
  }
  return { ok: true, supabase }
}

function parseName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_NAME_LENGTH) return null
  return trimmed
}

function parseUnit(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_UNIT_LENGTH) return null
  return trimmed
}

function parseSortOrder(value: unknown): number | null {
  const raw =
    typeof value === 'string' ? value.trim() : value == null ? '' : String(value)
  if (raw === '') return 0
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0 || n > MAX_SORT_ORDER) return null
  return n
}

export async function createMetricItem(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth

  const name = parseName(formData.get('name'))
  const unit = parseUnit(formData.get('unit'))
  const sortOrder = parseSortOrder(formData.get('sort_order'))
  if (!name) return { ok: false, error: '请填写名称（最多 50 字）' }
  if (!unit) return { ok: false, error: '请填写单位（最多 20 字）' }
  if (sortOrder === null) return { ok: false, error: '排序需为 0–10000 的整数' }

  const { error } = await auth.supabase
    .from('metric_items')
    .insert({ name, unit, sort_order: sortOrder, is_active: true })
  if (error) return { ok: false, error: '创建失败，请稍后重试' }

  revalidatePath('/admin/metrics')
  return { ok: true }
}

export async function updateMetricItem(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth
  if (typeof id !== 'string' || !id) return { ok: false, error: '参数错误' }

  const name = parseName(formData.get('name'))
  const unit = parseUnit(formData.get('unit'))
  const sortOrder = parseSortOrder(formData.get('sort_order'))
  if (!name) return { ok: false, error: '请填写名称（最多 50 字）' }
  if (!unit) return { ok: false, error: '请填写单位（最多 20 字）' }
  if (sortOrder === null) return { ok: false, error: '排序需为 0–10000 的整数' }

  const { error } = await auth.supabase
    .from('metric_items')
    .update({ name, unit, sort_order: sortOrder })
    .eq('id', id)
  if (error) return { ok: false, error: '保存失败，请稍后重试' }

  revalidatePath('/admin/metrics')
  return { ok: true }
}

export async function setMetricItemActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth
  if (typeof id !== 'string' || !id) return { ok: false, error: '参数错误' }

  const { error } = await auth.supabase
    .from('metric_items')
    .update({ is_active: Boolean(isActive) })
    .eq('id', id)
  if (error) return { ok: false, error: '更新失败，请稍后重试' }

  revalidatePath('/admin/metrics')
  return { ok: true }
}

export async function deleteMetricItem(id: string): Promise<ActionResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return auth
  if (typeof id !== 'string' || !id) return { ok: false, error: '参数错误' }

  const { error } = await auth.supabase
    .from('metric_items')
    .delete()
    .eq('id', id)
  if (error) return { ok: false, error: '删除失败，请稍后重试' }

  revalidatePath('/admin/metrics')
  return { ok: true }
}

