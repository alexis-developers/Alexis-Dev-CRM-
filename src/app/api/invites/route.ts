import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { invites, profiles } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { headers } from 'next/headers'

function generateToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length))
  return result
}

async function getCallerProfile(userId: string) {
  const [p] = await db.select().from(profiles).where(eq(profiles.user_id, userId)).limit(1)
  return p
}

// GET — list invites for THIS tenant only (super admin)
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const profile = await getCallerProfile(session.user.id)
  if (!profile?.is_super_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const tenantId = profile.tenant_id || profile.user_id
  const allInvites = await db.select().from(invites)
    .where(eq(invites.tenant_id, tenantId))
    .orderBy(desc(invites.created_at))

  return NextResponse.json(allInvites)
}

// POST — create invite scoped to THIS tenant
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const profile = await getCallerProfile(session.user.id)
  if (!profile?.is_super_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const tenantId = profile.tenant_id || profile.user_id
  const body = await request.json().catch(() => ({}))
  const { email, role = 'agent' } = body

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 7)

  const token = generateToken()
  const [invite] = await db.insert(invites).values({
    token,
    tenant_id: tenantId,
    email: email || null,
    role,
    created_by_user_id: session.user.id,
    created_by_name: session.user.name,
    expires_at: expiresAt.toISOString(),
  }).returning()

  return NextResponse.json(invite)
}

// DELETE — revoke invite (only within same tenant)
export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const profile = await getCallerProfile(session.user.id)
  if (!profile?.is_super_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  const tenantId = profile.tenant_id || profile.user_id

  // Verify the invite belongs to this tenant before deleting
  const [invite] = await db.select().from(invites).where(eq(invites.id, id)).limit(1)
  if (!invite || invite.tenant_id !== tenantId) {
    return NextResponse.json({ error: 'Convite não encontrado neste tenant' }, { status: 404 })
  }

  await db.delete(invites).where(eq(invites.id, id))
  return NextResponse.json({ ok: true })
}
