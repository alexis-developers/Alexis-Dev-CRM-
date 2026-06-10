import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { license_keys, profiles } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { headers } from 'next/headers'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

function generateKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const segment = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `ALEXIS-${segment()}-${segment()}-${segment()}-${segment()}`
}

function saveKeysToFile(keys: string[], label: string, role: string) {
  try {
    const dir = join(process.cwd(), 'licenses')
    mkdirSync(dir, { recursive: true })
    const now = new Date()
    const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `keys-${ts}.txt`
    const path = join(dir, filename)
    const lines = [
      '=====================================',
      '  ALEXIS CRM — Chaves de Licença OEM',
      '=====================================',
      `Geradas em: ${now.toLocaleString('pt-BR')}`,
      `Descrição:  ${label || '(sem descrição)'}`,
      `Nível:      ${role === 'admin' ? 'Admin' : 'Agente'}`,
      `Total:      ${keys.length} chave(s)`,
      '=====================================',
      '',
      ...keys.map((k, i) => `${String(i + 1).padStart(3, '0')}. ${k}`),
      '',
      '=====================================',
      'Use em: /signup?key=<CHAVE>',
      'Ou cole no campo "Chave de Licença" da tela de cadastro.',
      '=====================================',
    ]
    writeFileSync(path, lines.join('\n'), 'utf-8')
    return filename
  } catch {
    return null
  }
}

// GET — list all license keys (super admin only)
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (session.user.email !== process.env.SYSTEM_OWNER_EMAIL) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const keys = await db.select().from(license_keys).orderBy(desc(license_keys.created_at))
  return NextResponse.json(keys)
}

// POST — generate license keys (super admin only)
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (session.user.email !== process.env.SYSTEM_OWNER_EMAIL) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const { quantity = 1, role = 'agent', label = '', max_uses = 1, expires_days } = body

  const qty = Math.min(Math.max(1, Number(quantity)), 50)
  const expiresAt = expires_days
    ? (() => { const d = new Date(); d.setDate(d.getDate() + Number(expires_days)); return d.toISOString() })()
    : null

  const generated: string[] = []
  const inserted = []

  for (let i = 0; i < qty; i++) {
    const key = generateKey()
    generated.push(key)
    const [row] = await db.insert(license_keys).values({
      key,
      label: label || null,
      role,
      max_uses: Number(max_uses),
      use_count: 0,
      is_active: true,
      created_by_user_id: session.user.id,
      created_by_name: session.user.name,
      expires_at: expiresAt,
    }).returning()
    inserted.push(row)
  }

  const savedFile = saveKeysToFile(generated, label, role)

  return NextResponse.json({ keys: inserted, savedFile, generated })
}

// DELETE — revoke license key
export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (session.user.email !== process.env.SYSTEM_OWNER_EMAIL) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 })

  await db.update(license_keys).set({ is_active: false }).where(eq(license_keys.id, id))
  return NextResponse.json({ ok: true })
}
