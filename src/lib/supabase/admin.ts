import { createCompatClient } from '@/lib/db/compat'

// Drop-in replacement for the Supabase admin/service-role client.
// Uses the same Drizzle instance — authorization is enforced in route handlers.
export function createAdminClient() {
  return createCompatClient()
}
