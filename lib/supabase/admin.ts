// SERVER-ONLY. Never import this module from a Client Component or any code
// that ships to the browser. It uses SUPABASE_SERVICE_ROLE_KEY, which bypasses
// all Row Level Security and must remain on the server.
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

if (typeof window !== 'undefined') {
  throw new Error(
    'lib/supabase/admin.ts must not be imported from client code (service_role key would leak).',
  )
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.',
    )
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

