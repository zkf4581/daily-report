import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy-session'

// Next.js 16: route guard lives in `proxy.ts` (formerly `middleware.ts`) and
// the exported function is `proxy`. See §5/§9 of `需求与技术方案.md`.
//
// Flow:
//   1. `updateSession` refreshes Supabase auth cookies and returns the current user.
//   2. Anonymous requests are sent to `/login`.
//   3. Contractors hitting admin paths are bounced to `/today`.
//      Authoritative role check still happens server-side against `profiles.role`
//      before any sensitive mutation; this is just a fast UX redirect.
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const { pathname } = request.nextUrl

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  const role = (user.app_metadata as { role?: unknown } | undefined)?.role
  const isContractor = role !== 'admin'
  const isAdminPath =
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/api/admin' ||
    pathname.startsWith('/api/admin/')

  if (isContractor && isAdminPath) {
    const url = request.nextUrl.clone()
    url.pathname = '/today'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*', '/today', '/history', '/api/admin/:path*'],
}

