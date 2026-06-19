'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { todayInTimeZone } from '@/lib/datetime'
import { createClient } from '@/lib/supabase/server'

// Surface friendly, non-sensitive validation/result codes via the URL.
// The page reads them and renders both an inline message and a sonner toast.
const ERR = {
  done_required: '/today?error=done',
  invalid_minutes: '/today?error=minutes',
  save_failed: '/today?error=save',
} as const

const DEFAULT_TZ = 'Asia/Shanghai'

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
  const minutesRaw = String(formData.get('minutes_spent') ?? '').trim()

  if (!done) {
    redirect(ERR.done_required)
  }

  let minutesSpent: number | null = null
  if (minutesRaw !== '') {
    const n = Number(minutesRaw)
    if (!Number.isInteger(n) || n < 0) {
      redirect(ERR.invalid_minutes)
    }
    minutesSpent = n
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

  // RLS is the real boundary: it allows INSERT/UPDATE only when
  // `user_id = auth.uid()` and `report_date = (now() AT TIME ZONE profile tz)::date`.
  // Front-end values are only hints; the DB will reject anything else.
  const { error: upsertError } = await supabase
    .from('reports')
    .upsert(
      {
        user_id: user.id,
        report_date: reportDate,
        done,
        blockers: blockers === '' ? null : blockers,
        tomorrow_plan: tomorrowPlan === '' ? null : tomorrowPlan,
        minutes_spent: minutesSpent,
      },
      { onConflict: 'user_id,report_date' },
    )
  if (upsertError) {
    redirect(ERR.save_failed)
  }

  revalidatePath('/today')
  revalidatePath('/history')
  redirect('/today?saved=1')
}

