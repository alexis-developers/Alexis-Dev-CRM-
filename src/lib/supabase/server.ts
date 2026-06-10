import { createCompatClient } from '@/lib/db/compat'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

// Drop-in replacement for the Supabase server client.
// Session is read from BetterAuth cookies via next/headers.
export async function createClient() {
  const headerStore = await headers()
  const cookieHeader = headerStore.get('cookie') ?? ''

  const session = await auth.api.getSession({
    headers: new Headers({ cookie: cookieHeader }),
  })

  return {
    ...createCompatClient(),
    auth: {
      getUser: async () => ({
        data: { user: session?.user ?? null },
        error: null,
      }),
      getSession: async () => ({
        data: { session: session ?? null },
        error: null,
      }),
    },
    _session: session,
    _user: session?.user ?? null,
  }
}
