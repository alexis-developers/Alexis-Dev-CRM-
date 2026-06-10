import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { license_keys, user } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'

// GET /api/licenses/validate?key=ALEXIS-XXXX-... — public validation
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')?.trim().toUpperCase()

  // First user check (no key needed)
  const userCount = await db.select({ count: sql<number>`count(*)` }).from(user)
  if (userCount[0].count === 0) {
    return NextResponse.json({ valid: true, isFirstUser: true })
  }

  if (!key) {
    return NextResponse.json({ valid: false, error: 'Chave de licença não informada.' }, { status: 400 })
  }

  const [lic] = await db.select().from(license_keys).where(eq(license_keys.key, key)).limit(1)

  if (!lic) return NextResponse.json({ valid: false, error: 'Chave de licença inválida.' }, { status: 404 })
  if (!lic.is_active) return NextResponse.json({ valid: false, error: 'Esta chave foi revogada.' }, { status: 410 })
  if (lic.expires_at && new Date(lic.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, error: 'Esta chave de licença expirou.' }, { status: 410 })
  }
  if ((lic.use_count ?? 0) >= (lic.max_uses ?? 1)) {
    return NextResponse.json({ valid: false, error: 'Esta chave já atingiu o limite de usos.' }, { status: 410 })
  }

  return NextResponse.json({ valid: true, isFirstUser: false, role: lic.role, label: lic.label })
}
