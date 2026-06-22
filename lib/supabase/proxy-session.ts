import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

/**
 * Session refresh helper used from `proxy.ts`.
 *
 * Reads auth cookies from the incoming request, lets `@supabase/ssr` refresh
 * the access/refresh tokens if needed, and writes any updated cookies onto a
 * fresh `NextResponse` that the caller must return (or further mutate).
 *
 * Callers should not run async work between constructing the client and the
 * `getUser()` call below — that pattern is required by `@supabase/ssr` so the
 * refreshed tokens land on the response.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user, supabase }
}

