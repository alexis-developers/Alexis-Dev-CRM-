import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'

// GET /api/license-status — returns current user's license status
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ status: 'unauthenticated' }, { status: 401 })

  const [profile] = await db.select().from(profiles).where(eq(profiles.user_id, session.user.id)).limit(1)

  if (!profile) {
    return NextResponse.json({ status: 'no_profile', expired: false })
  }

  const expiresAt = profile.license_expires_at
  const isSuperAdmin = !!profile.is_super_admin

  if (!expiresAt) {
    // Super admin or legacy user — grant access, set 1-year license
    const oneYear = new Date()
    oneYear.setFullYear(oneYear.getFullYear() + 1)
    await db.update(profiles)
      .set({ license_expires_at: oneYear.toISOString() })
      .where(eq(profiles.user_id, session.user.id))
    return NextResponse.json({ status: 'active', expired: false, expiresAt: oneYear.toISOString(), isSuperAdmin })
  }

  const expired = new Date(expiresAt) < new Date()
  const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  return NextResponse.json({
    status: expired ? 'expired' : 'active',
    expired,
    expiresAt,
    daysLeft: expired ? 0 : daysLeft,
    isSuperAdmin,
    email: session.user.email,
  })
}

// POST /api/license-status/renew — super admin can manually extend a user's license
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const [me] = await db.select().from(profiles).where(eq(profiles.user_id, session.user.id)).limit(1)
  if (!me?.is_super_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { userId } = body
  if (!userId) return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 })

  const target = await db.select().from(profiles).where(eq(profiles.user_id, userId)).limit(1)
  if (!target[0]) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  const currentExpiry = target[0].license_expires_at
  const base = currentExpiry && new Date(currentExpiry) > new Date() ? new Date(currentExpiry) : new Date()
  base.setFullYear(base.getFullYear() + 1)

  await db.update(profiles)
    .set({ license_expires_at: base.toISOString() })
    .where(eq(profiles.user_id, userId))

  return NextResponse.json({ ok: true, newExpiresAt: base.toISOString() })
}
