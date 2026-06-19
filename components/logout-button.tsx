import { signOut } from '@/app/login/actions'

import { Button } from './ui/button'

// Minimal reusable logout control. Posts to the `signOut` Server Action which
// clears the Supabase session and redirects to `/login`.
export function LogoutButton({ className }: { className?: string }) {
  return (
    <form action={signOut} className={className}>
      <Button type="submit" variant="outline" size="sm">
        登出
      </Button>
    </form>
  )
}

