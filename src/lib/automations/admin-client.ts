import { createCompatClient } from '@/lib/db/compat'

let _adminClient: ReturnType<typeof createCompatClient> | null = null

export function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createCompatClient()
  }
  return _adminClient
}
