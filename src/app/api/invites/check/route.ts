import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invites, user } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

// GET /api/invites/check?token=xxx — public validation
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  const userCount = await db.select({ count: sql<number>`count(*)` }).from(user)
  const isFirstUser = userCount[0].count === 0

  if (isFirstUser) {
    return NextResponse.json({ valid: true, isFirstUser: true })
  }

  if (!token) {
    return NextResponse.json({ valid: false, error: 'Token de convite obrigatório' }, { status: 400 })
  }

  const [invite] = await db.select().from(invites).where(eq(invites.token, token)).limit(1)

  if (!invite) {
    return NextResponse.json({ valid: false, error: 'Convite inválido ou não encontrado' }, { status: 404 })
  }
  if (invite.used_at) {
    return NextResponse.json({ valid: false, error: 'Este convite já foi utilizado' }, { status: 410 })
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, error: 'Este convite expirou' }, { status: 410 })
  }

  return NextResponse.json({
    valid: true,
    isFirstUser: false,
    email: invite.email,
    role: invite.role,
    tenant_id: invite.tenant_id,
  })
}
