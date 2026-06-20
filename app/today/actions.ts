'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { todayInTimeZone } from '@/lib/datetime'
import { createClient } from '@/lib/supabase/server'

// Surface friendly, non-sensitive validation/result codes via the URL.
// The page reads them and renders both an inline message and a sonner toast.
const ERR = {
  empty: '/today?error=empty',
  invalid_metric: '/today?error=metric',
  save_failed: '/today?error=save',
} as const

const DEFAULT_TZ = 'Asia/Shanghai'
const METRIC_KEY_RE = /^metric_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

type MetricInput = { id: string; value: number | null }

export async function saveTodayReport(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const done = String(formData.get('done') ?? '').trim()
  const blockers = String(formData.get('blockers') ?? '').trim()
  const tomorrowPlan = String(formData.get('tomorrow_plan') ?? '').trim()

  // Parse every metric_<uuid> input. Empty string → null (clear). Non-empty
  // must be a finite number ≥ 0 (decimals allowed per §P8 design decision 5).
  const metricInputs: MetricInput[] = []
  for (const [key, raw] of formData.entries()) {
    const m = key.match(METRIC_KEY_RE)
    if (!m) continue
    const s = String(raw ?? '').trim()
    if (s === '') {
      metricInputs.push({ id: m[1], value: null })
      continue
    }
    const n = Number(s)
    if (!Number.isFinite(n) || n < 0) {
      redirect(ERR.invalid_metric)
    }
    metricInputs.push({ id: m[1], value: n })
  }

  // At least one of: done text, or any metric value (§P8b: 至少填一项).
  const hasMetric = metricInputs.some((m) => m.value != null)
  if (!done && !hasMetric) {
    redirect(ERR.empty)
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single()
  if (profileError || !profile) {
    redirect(ERR.save_failed)
  }

  const timezone = profile.timezone || DEFAULT_TZ
  const reportDate = todayInTimeZone(timezone)

  // Upsert reports first — report_metrics has a composite FK on
  // (user_id, report_date), so the parent row must exist even when `done` is
  // null and only metrics were filled.
  const { error: upsertError } = await supabase
    .from('reports')
    .upsert(
      {
        user_id: user.id,
        report_date: reportDate,
        done: done === '' ? null : done,
        blockers: blockers === '' ? null : blockers,
        tomorrow_plan: tomorrowPlan === '' ? null : tomorrowPlan,
      },
      { onConflict: 'user_id,report_date' },
    )
  if (upsertError) {
    redirect(ERR.save_failed)
  }

  // Upsert filled metrics, delete cleared ones. RLS rejects anything that is
  // not "self + today in own tz"; we don't need to re-check here.
  const toUpsert = metricInputs
    .filter((m) => m.value != null)
    .map((m) => ({
      user_id: user.id,
      report_date: reportDate,
      metric_item_id: m.id,
      value: m.value as number,
    }))
  if (toUpsert.length > 0) {
    const { error: metricsError } = await supabase
      .from('report_metrics')
      .upsert(toUpsert, { onConflict: 'user_id,report_date,metric_item_id' })
    if (metricsError) {
      redirect(ERR.save_failed)
    }
  }

  const toClear = metricInputs.filter((m) => m.value == null).map((m) => m.id)
  if (toClear.length > 0) {
    const { error: deleteError } = await supabase
      .from('report_metrics')
      .delete()
      .eq('user_id', user.id)
      .eq('report_date', reportDate)
      .in('metric_item_id', toClear)
    if (deleteError) {
      redirect(ERR.save_failed)
    }
  }

  revalidatePath('/today')
  revalidatePath('/history')
  redirect('/today?saved=1')
}

