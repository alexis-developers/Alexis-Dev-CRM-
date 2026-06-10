import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { profiles, tenants } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'

// GET /api/me — returns full context: user + profile + tenant
export async function GET(_req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const [profile] = await db.select().from(profiles).where(eq(profiles.user_id, session.user.id)).limit(1)

  if (!profile) {
    return NextResponse.json({
      user: session.user,
      profile: null,
      tenant: null,
      tenantId: session.user.id,
    })
  }

  const tenantId = profile.tenant_id && profile.tenant_id !== '' ? profile.tenant_id : session.user.id
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)

  const isSystemOwner = session.user.email === process.env.SYSTEM_OWNER_EMAIL

  return NextResponse.json({
    user: session.user,
    profile,
    tenant,
    tenantId,
    isSuperAdmin: !!profile.is_super_admin,
    isSystemOwner,
    role: profile.role,
    licenseExpiresAt: profile.license_expires_at ?? tenant?.license_expires_at,
  })
}
