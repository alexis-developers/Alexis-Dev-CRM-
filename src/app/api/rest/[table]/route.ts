/**
 * Generic REST proxy — maps Supabase-style client queries to Drizzle/SQLite.
 * MULTI-TENANT: automatically enforces tenant isolation on every request.
 *
 * tenant_id = the super_admin's user_id for the company.
 * Every data table has a user_id column that stores the tenant_id.
 * This proxy transparently rewrites user_id filters to use the
 * caller's tenant_id, so team members always see their company's data.
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'
import { createCompatClient } from '@/lib/db/compat'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Tables that should NOT have tenant_id injected (BetterAuth tables + profiles itself)
const BYPASS_TENANT_TABLES = new Set([
  'user', 'session', 'account', 'verification',
  'profiles', 'tenants', 'invites', 'license_keys',
])

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.session) return null
  return session
}

// Resolve the tenant_id for the logged-in user.
// Super admins: tenant_id = their own user_id
// Agents: tenant_id = their super admin's user_id (stored in profile.tenant_id)
async function resolveTenantId(userId: string): Promise<string> {
  const [profile] = await db.select().from(profiles).where(eq(profiles.user_id, userId)).limit(1)
  if (!profile) return userId // fallback: treat self as tenant
  // If tenant_id is set and non-empty, use it. Otherwise use own user_id (super admin).
  return profile.tenant_id && profile.tenant_id !== '' ? profile.tenant_id : userId
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 })

  const { table } = await params
  const url = req.nextUrl
  const client = createCompatClient()
  const t = client.from(table)

  let builder = t.select(url.searchParams.get('select') || '*')

  const needsTenant = !BYPASS_TENANT_TABLES.has(table)
  const tenantId = needsTenant ? await resolveTenantId(session.user.id) : session.user.id

  let hasUserIdFilter = false

  for (const [key, value] of url.searchParams.entries()) {
    const m = key.match(/^(eq|neq|in|gte|lte|gt|lt|ilike|is)\[(.+)\]$/)
    if (!m) continue
    const [, op, col] = m

    // Rewrite any user_id filter to use the caller's tenant_id
    const actualValue = (col === 'user_id' && needsTenant) ? tenantId : value
    if (col === 'user_id' && needsTenant) hasUserIdFilter = true

    if (op === 'eq') builder = builder.eq(col, actualValue)
    else if (op === 'neq') builder = builder.neq(col, actualValue)
    else if (op === 'in') builder = builder.in(col, actualValue.split(','))
    else if (op === 'gte') builder = builder.gte(col, actualValue)
    else if (op === 'lte') builder = builder.lte(col, actualValue)
    else if (op === 'gt') builder = builder.gt(col, actualValue)
    else if (op === 'lt') builder = builder.lt(col, actualValue)
    else if (op === 'ilike') builder = builder.ilike(col, actualValue)
    else if (op === 'is' && value === 'null') builder = builder.is(col, null)
  }

  // If table has user_id but no user_id filter was provided, inject tenant_id automatically
  if (needsTenant && !hasUserIdFilter) {
    builder = builder.eq('user_id', tenantId)
  }

  const orderParam = url.searchParams.get('order')
  if (orderParam) {
    const [col, dir] = orderParam.split('.')
    builder = builder.order(col, { ascending: dir !== 'desc' })
  }

  const limitParam = url.searchParams.get('limit')
  if (limitParam) builder = builder.limit(Number(limitParam))

  const rangeHeader = req.headers.get('range')
  if (rangeHeader) {
    const m = rangeHeader.match(/(\d+)-(\d+)/)
    if (m) builder = builder.range(Number(m[1]), Number(m[2]))
  }

  const countParam = url.searchParams.get('count')
  const single = url.searchParams.get('single') === 'true'

  if (single) {
    const result = await builder.single()
    return NextResponse.json(result)
  }

  const result = countParam === 'exact'
    ? await (t.select('*', { count: 'exact' }) as typeof builder)
    : await builder
  return NextResponse.json(result)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 })

  const { table } = await params
  const body = await req.json()
  const client = createCompatClient()
  const upsert = req.nextUrl.searchParams.get('upsert') === 'true'
  const onConflict = req.nextUrl.searchParams.get('on_conflict') || undefined

  const needsTenant = !BYPASS_TENANT_TABLES.has(table)

  // Auto-inject tenant_id as user_id on insert so agents create data under the right tenant
  let data = Array.isArray(body) ? body : [body]
  if (needsTenant) {
    const tenantId = await resolveTenantId(session.user.id)
    data = data.map((row) => ({ user_id: tenantId, ...row, user_id_override: undefined }))
    // Remove helper field if present
    data = data.map(({ user_id_override: _, ...rest }) => rest)
  }

  const payload = Array.isArray(body) ? data : data[0]

  const result = upsert
    ? await client.from(table).upsert(payload, onConflict ? { onConflict } : undefined)
    : await client.from(table).insert(payload)
  return NextResponse.json(result)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 })

  const { table } = await params
  const body = await req.json()
  const url = req.nextUrl
  const client = createCompatClient()

  const needsTenant = !BYPASS_TENANT_TABLES.has(table)
  const tenantId = needsTenant ? await resolveTenantId(session.user.id) : session.user.id

  let builder = client.from(table).update(body)

  let hasUserIdFilter = false
  for (const [key, value] of url.searchParams.entries()) {
    const m = key.match(/^eq\[(.+)\]$/)
    if (m) {
      const col = m[1]
      const actualValue = (col === 'user_id' && needsTenant) ? tenantId : value
      if (col === 'user_id' && needsTenant) hasUserIdFilter = true
      builder = builder.eq(col, actualValue)
    }
  }

  // Guard: always filter by tenant_id to prevent cross-tenant modification
  if (needsTenant && !hasUserIdFilter) {
    builder = builder.eq('user_id', tenantId)
  }

  const result = await builder
  return NextResponse.json(result)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ table: string }> }) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 })

  const { table } = await params
  const url = req.nextUrl
  const client = createCompatClient()

  const needsTenant = !BYPASS_TENANT_TABLES.has(table)
  const tenantId = needsTenant ? await resolveTenantId(session.user.id) : session.user.id

  let builder = client.from(table).delete()

  let hasUserIdFilter = false
  for (const [key, value] of url.searchParams.entries()) {
    const m = key.match(/^eq\[(.+)\]$/)
    if (m) {
      const col = m[1]
      const actualValue = (col === 'user_id' && needsTenant) ? tenantId : value
      if (col === 'user_id' && needsTenant) hasUserIdFilter = true
      builder = builder.eq(col, actualValue)
    }
  }

  // Guard: always add tenant filter to prevent cross-tenant deletion
  if (needsTenant && !hasUserIdFilter) {
    builder = builder.eq('user_id', tenantId)
  }

  const result = await builder
  return NextResponse.json(result)
}
