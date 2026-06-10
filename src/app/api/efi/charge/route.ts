import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sales } from '@/lib/db/schema'
import { efiCreateCharge, efiCreateCardLink } from '@/lib/efi'

// POST /api/efi/charge
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const { email, companyName, isRenewal = false, renewalTenantId, paymentMethod = 'pix' } = body

  if (!email || !companyName) {
    return NextResponse.json({ error: 'email e companyName obrigatórios' }, { status: 400 })
  }

  const priceRes = await fetch(new URL('/api/preco', request.url).toString())
  const priceData = priceRes.ok ? await priceRes.json() : { preco_atual: parseFloat(process.env.LICENSE_PRICE_BRL ?? '680') }
  const amount: number = priceData.preco_atual ?? 680

  const description = isRenewal
    ? `Renovação Alexis CRM — ${companyName}`
    : `Licença Alexis CRM — ${companyName} — 1 ano`

  try {
    if (paymentMethod === 'card') {
      // ─── CARTÃO DE CRÉDITO ────────────────────────────────────────────────
      // First create a placeholder sale record to get the ID for custom_id
      const [salePlaceholder] = await db.insert(sales).values({
        email,
        company_name: companyName,
        amount,
        currency: 'BRL',
        payment_method: 'card',
        efi_txid: `PENDING-${Date.now()}`,
        payment_status: 'pending',
        is_renewal: isRenewal,
        renewal_tenant_id: renewalTenantId ?? null,
      }).returning()

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
      const redirectUrl = `${siteUrl}/checkout?paid=1&method=card&chargeId=PLACEHOLDER&email=${encodeURIComponent(email)}`

      const { chargeId, paymentLink } = await efiCreateCardLink({
        email,
        name: companyName,
        amount,
        description,
        saleId: salePlaceholder.id,
        redirectUrl: redirectUrl.replace('PLACEHOLDER', ''),
      })

      // Update sale with real chargeId
      await db.update(sales)
        .set({ efi_txid: `CHG-${chargeId}` })
        .where(((await import('drizzle-orm')).eq)(sales.id, salePlaceholder.id))

      const finalRedirect = `${siteUrl}/checkout?paid=1&method=card&chargeId=${chargeId}&email=${encodeURIComponent(email)}`

      return NextResponse.json({
        ok: true,
        paymentMethod: 'card',
        chargeId,
        paymentLink,
        amount,
        redirectUrl: finalRedirect,
      })
    }

    // ─── PIX ─────────────────────────────────────────────────────────────────
    const charge = await efiCreateCharge({ email, name: companyName, amount, description })
    const expiresAt = new Date(Date.now() + 3600_000).toISOString()

    const [sale] = await db.insert(sales).values({
      email,
      company_name: companyName,
      amount,
      currency: 'BRL',
      payment_method: 'pix',
      efi_txid: charge.txid,
      efi_loc_id: charge.loc?.id ? String(charge.loc.id) : null,
      pix_copia_cola: charge.pixCopiaECola,
      qr_code_image: charge.qrCodeBase64,
      payment_status: 'pending',
      is_renewal: isRenewal,
      renewal_tenant_id: renewalTenantId ?? null,
      expires_pix_at: expiresAt,
    }).returning()

    return NextResponse.json({
      ok: true,
      paymentMethod: 'pix',
      saleId: sale.id,
      txid: charge.txid,
      pixCopiaECola: charge.pixCopiaECola,
      qrCodeBase64: charge.qrCodeBase64,
      amount,
      expiresAt,
    })
  } catch (e) {
    console.error('[efi/charge]', e)
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
