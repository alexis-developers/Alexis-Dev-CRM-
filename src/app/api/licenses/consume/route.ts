import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { license_keys, profiles, tenants, user } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

function oneYearFromNow() {
  const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString()
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { key, userId, userName, userEmail } = body

  if (!userId || !userEmail) {
    return NextResponse.json({ error: 'userId e userEmail obrigatórios' }, { status: 400 })
  }

  const userCount = await db.select({ count: sql<number>`count(*)` }).from(user)
  const isSuperAdmin = userCount[0].count === 1
  const licenseExpiresAt = oneYearFromNow()
  const tenantId = userId  // license user = their own tenant

  let role = 'agent'
  let usedKey = key?.trim().toUpperCase() ?? null

  if (!isSuperAdmin && usedKey) {
    const [lic] = await db.select().from(license_keys).where(eq(license_keys.key, usedKey)).limit(1)
    if (lic && lic.is_active && (lic.use_count ?? 0) < (lic.max_uses ?? 1)) {
      role = lic.role ?? 'agent'
      if (role === 'super_admin' || role === 'admin') {
        // License activates a new tenant (company buying the CRM)
        // Create tenant record for this new company
        await db.insert(tenants).values({
          id: userId,
          name: userName || userEmail,
          email: userEmail,
          license_key: usedKey,
          license_expires_at: licenseExpiresAt,
          plan: 'oem',
        }).onConflictDoNothing()
      }
      await db.update(license_keys)
        .set({ use_count: (lic.use_count ?? 0) + 1 })
        .where(eq(license_keys.id, lic.id))
    }
  } else if (isSuperAdmin) {
    // First ever user — always creates their own tenant
    await db.insert(tenants).values({
      id: userId,
      name: userName || userEmail,
      email: userEmail,
      license_key: usedKey,
      license_expires_at: licenseExpiresAt,
      plan: 'oem',
    }).onConflictDoNothing()
  }

  const existing = await db.select().from(profiles).where(eq(profiles.user_id, userId)).limit(1)
  const profileData = {
    full_name: userName || userEmail,
    email: userEmail,
    role: isSuperAdmin ? 'super_admin' : role,
    is_super_admin: isSuperAdmin,
    tenant_id: tenantId,
    ativo: true,
    license_expires_at: licenseExpiresAt,
    license_key: usedKey,
  }

  if (existing.length === 0) {
    await db.insert(profiles).values({ user_id: userId, ...profileData })
  } else {
    await db.update(profiles).set(profileData).where(eq(profiles.user_id, userId))
  }

  return NextResponse.json({ ok: true, isSuperAdmin, tenantId, role: profileData.role, licenseExpiresAt })
}
