// Shared date/timezone helpers used across the app.
//
// `todayInTimeZone` returns the calendar date (YYYY-MM-DD) for the supplied
// IANA time zone, derived from `Intl.DateTimeFormat`. It deliberately ignores
// the server/browser local clock so the "today-only edit, past locked"
// boundary stays consistent with the user's own timezone (see §3.3 / §7.5 of
// 需求与技术方案.md, RLS uses `now() AT TIME ZONE profiles.timezone`).
//
// `formatMinutes` converts an integer number of minutes into the human label
// described in §3.2 ("X 小时 Y 分").
//
// Both helpers are reused by the admin pages in P4.

const FORMATTERS = new Map<string, Intl.DateTimeFormat>()

function getDateFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = FORMATTERS.get(timeZone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    FORMATTERS.set(timeZone, f)
  }
  return f
}

/**
 * Returns the calendar date in the supplied IANA timezone as a `YYYY-MM-DD`
 * string. Throws if the timezone is invalid (so callers can fall back to a
 * sane default like `Asia/Shanghai`).
 */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  const parts = getDateFormatter(timeZone).formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  const day = parts.find((p) => p.type === 'day')?.value
  if (!year || !month || !day) {
    throw new Error(`Failed to format date for time zone "${timeZone}"`)
  }
  return `${year}-${month}-${day}`
}

/**
 * Formats a non-negative integer minute count as "X 小时 Y 分" (see §3.2).
 * Returns a dash for nullish / invalid inputs so callers can pass through DB
 * NULLs without extra branching.
 *
 * Kept for backwards compatibility after P8b removed the `minutes_spent`
 * column; new code uses the metric_items pipeline instead.
 */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return '—'
  const total = Math.floor(minutes)
  const hours = Math.floor(total / 60)
  const remainder = total % 60
  if (hours === 0) return `${remainder} 分`
  if (remainder === 0) return `${hours} 小时`
  return `${hours} 小时 ${remainder} 分`
}

/**
 * Returns the Monday of the current ISO week (in the supplied IANA timezone)
 * as a `YYYY-MM-DD` string. Day-of-week is a pure calendar property of the
 * date string, so we compute it via UTC arithmetic on the local date — no
 * tz-shift surprises.
 */
export function startOfWeekInTimeZone(
  timeZone: string,
  now: Date = new Date(),
): string {
  const today = todayInTimeZone(timeZone, now)
  const [y, m, d] = today.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  const dow = utc.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
  const offset = dow === 0 ? 6 : dow - 1
  utc.setUTCDate(utc.getUTCDate() - offset)
  return formatUTCDate(utc)
}

/**
 * Returns the first day of the current month (in the supplied IANA timezone)
 * as a `YYYY-MM-DD` string.
 */
export function startOfMonthInTimeZone(
  timeZone: string,
  now: Date = new Date(),
): string {
  const today = todayInTimeZone(timeZone, now)
  return `${today.slice(0, 7)}-01`
}

function formatUTCDate(d: Date): string {
  const y = d.getUTCFullYear().toString().padStart(4, '0')
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = d.getUTCDate().toString().padStart(2, '0')
  return `${y}-${m}-${day}`
}

