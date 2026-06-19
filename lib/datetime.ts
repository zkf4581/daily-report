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

