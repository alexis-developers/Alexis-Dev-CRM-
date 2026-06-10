import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invites, profiles, tenants, user } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

function oneYearFromNow() {
  const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString()
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { token, userId, userName, userEmail } = body

  if (!userId || !userEmail) {
    return NextResponse.json({ error: 'userId e userEmail obrigatórios' }, { status: 400 })
  }

  const userCount = await db.select({ count: sql<number>`count(*)` }).from(user)
  const isSuperAdmin = userCount[0].count === 1
  const licenseExpiresAt = oneYearFromNow()

  let role = 'agent'
  let tenantId = userId // for super admin: tenant = self

  if (isSuperAdmin) {
    // Create the tenant record
    await db.insert(tenants).values({
      id: userId,
      name: userName || userEmail,
      email: userEmail,
      license_expires_at: licenseExpiresAt,
      plan: 'oem',
    }).onConflictDoNothing()
  } else if (token) {
    // Validate and consume invite — must match a valid tenant
    const [invite] = await db.select().from(invites).where(eq(invites.token, token)).limit(1)
    if (invite && !invite.used_at && new Date(invite.expires_at) >= new Date()) {
      role = invite.role ?? 'agent'
      tenantId = invite.tenant_id  // agent joins the inviting company's tenant
      await db.update(invites)
        .set({ used_by_user_id: userId, used_at: new Date().toISOString() })
        .where(eq(invites.id, invite.id))
    } else {
      return NextResponse.json({ error: 'Convite inválido ou expirado.' }, { status: 400 })
    }
  }

  // Upsert profile with tenant_id
  const existing = await db.select().from(profiles).where(eq(profiles.user_id, userId)).limit(1)
  const profileData = {
    full_name: userName || userEmail,
    email: userEmail,
    role: isSuperAdmin ? 'super_admin' : role,
    is_super_admin: isSuperAdmin,
    tenant_id: tenantId,
    ativo: true,
    license_expires_at: isSuperAdmin ? licenseExpiresAt : undefined,
  }

  if (existing.length === 0) {
    await db.insert(profiles).values({ user_id: userId, ...profileData })
  } else {
    await db.update(profiles).set(profileData).where(eq(profiles.user_id, userId))
  }

  return NextResponse.json({ ok: true, isSuperAdmin, tenantId, role: profileData.role, licenseExpiresAt })
}
