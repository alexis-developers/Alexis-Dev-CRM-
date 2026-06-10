/**
 * Efi Bank Webhook — POST /api/efi/webhook
 *
 * Handles both PIX and card (cobranças) payment notifications.
 * PIX format:  { pix: [{ txid, valor, ... }] }
 * Card format: { type: 'charge', status: { current: 'paid' }, identifiers: { charge_id } }
 *
 * Efi sends a GET challenge first — we return the challenge value.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sales, license_keys, profiles, tenants } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { sendEmail } from '@/lib/email/send'
import { templateLicenseKey, templatePaymentConfirmed, templateRenewalReminder } from '@/lib/email/templates'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('challenge')
  if (challenge) return new Response(challenge, { status: 200 })
  return NextResponse.json({ ok: true })
}

function generateLicenseKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `ALEXIS-${seg()}-${seg()}-${seg()}-${seg()}`
}

function saveKeyToFile(key: string, email: string, companyName: string) {
  try {
    const dir = join(process.cwd(), 'licenses')
    mkdirSync(dir, { recursive: true })
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const content = [
      '====================================================',
      '  ALEXIS CRM — Chave Gerada Automaticamente (Pago)',
      '====================================================',
      `Data    : ${new Date().toLocaleString('pt-BR')}`,
      `Empresa : ${companyName}`,
      `Email   : ${email}`,
      `Chave   : ${key}`,
      '====================================================',
    ].join('\n')
    writeFileSync(join(dir, `auto-${ts}.txt`), content, 'utf-8')
  } catch { /* ignore fs errors in serverless */ }
}

type Sale = typeof sales.$inferSelect

async function processSale(sale: Sale, valorStr: string) {
  const paidAt = new Date().toISOString()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  if (sale.is_renewal && sale.renewal_tenant_id) {
    // ─── RENOVAÇÃO ──────────────────────────────────────────────────────────
    const newExpiry = new Date(Date.now() + 365 * 24 * 3600_000).toISOString()

    await db.update(tenants)
      .set({ license_expires_at: newExpiry, updated_at: paidAt })
      .where(eq(tenants.id, sale.renewal_tenant_id))
    await db.update(profiles)
      .set({ license_expires_at: newExpiry })
      .where(eq(profiles.tenant_id, sale.renewal_tenant_id))
    await db.update(sales)
      .set({ payment_status: 'paid', paid_at: paidAt, updated_at: paidAt })
      .where(eq(sales.id, sale.id))

    const priceRes = await fetch(`${siteUrl}/api/preco`)
    const priceData = priceRes.ok ? await priceRes.json() : { preco_atual: sale.amount }
    await sendEmail({
      to: sale.email,
      subject: '✅ Licença renovada — Alexis CRM',
      html: templateRenewalReminder({
        companyName: sale.company_name,
        daysLeft: 365,
        expiresAt: newExpiry,
        renewalUrl: `${siteUrl}/checkout?email=${encodeURIComponent(sale.email)}&renewal=1`,
        price: priceData.preco_atual,
      }),
    })
  } else {
    // ─── NOVA LICENÇA ────────────────────────────────────────────────────────
    const key = generateLicenseKey()
    const expiresAtStr = new Date(Date.now() + 365 * 24 * 3600_000).toISOString()

    const [licRow] = await db.insert(license_keys).values({
      key,
      label: sale.company_name,
      role: 'admin',
      max_uses: 1,
      use_count: 0,
      is_active: true,
      created_by_user_id: 'system',
      created_by_name: 'Pagamento Automático',
      expires_at: expiresAtStr,
    }).returning()

    await db.update(sales)
      .set({ payment_status: 'paid', paid_at: paidAt, license_key: key, license_key_id: licRow.id, updated_at: paidAt })
      .where(eq(sales.id, sale.id))

    saveKeyToFile(key, sale.email, sale.company_name)

    const signupUrl = `${siteUrl}/signup?key=${key}`
    await sendEmail({
      to: sale.email,
      subject: '✅ Pagamento confirmado — Alexis CRM',
      html: templatePaymentConfirmed({
        companyName: sale.company_name,
        amount: parseFloat(valorStr) || sale.amount,
        txid: sale.efi_txid ?? '',
      }),
    })
    await sendEmail({
      to: sale.email,
      subject: '🔑 Sua licença Alexis CRM chegou',
      html: templateLicenseKey({ companyName: sale.company_name, key, role: 'admin', signupUrl, expiresAt: expiresAtStr }),
    })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // ─── CARTÃO ──────────────────────────────────────────────────────────────
    if (body?.type === 'charge' && body?.status?.current === 'paid') {
      const chargeId = String(body?.identifiers?.charge_id ?? '')
      if (chargeId) {
        const [sale] = await db.select().from(sales).where(eq(sales.efi_txid, `CHG-${chargeId}`)).limit(1)
        if (sale && sale.payment_status !== 'paid') {
          await processSale(sale, String(sale.amount))
        }
      }
      return NextResponse.json({ ok: true })
    }

    // ─── PIX ─────────────────────────────────────────────────────────────────
    const pixEvents: Array<{ txid: string; valor: string }> = body?.pix ?? []
    for (const { txid, valor } of pixEvents) {
      if (!txid) continue
      const [sale] = await db.select().from(sales).where(eq(sales.efi_txid, txid)).limit(1)
      if (!sale || sale.payment_status === 'paid') continue
      await processSale(sale, valor)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[efi/webhook]', e)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
