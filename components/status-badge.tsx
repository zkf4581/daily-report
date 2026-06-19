import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Submission-status badge for the admin overview (§3.4).
// Green = submitted (a reports row exists for the (user, date) pair),
// Red   = not yet submitted.
export function SubmissionStatusBadge({ submitted }: { submitted: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5',
        submitted
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
          : 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'inline-block size-1.5 rounded-full',
          submitted ? 'bg-emerald-500' : 'bg-red-500',
        )}
      />
      {submitted ? '已交' : '未交'}
    </Badge>
  )
}

