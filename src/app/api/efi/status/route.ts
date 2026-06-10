import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sales } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { efiGetCardCharge } from '@/lib/efi'

// GET /api/efi/status?txid=xxx (PIX) or ?chargeId=xxx (cartão)
export async function GET(request: NextRequest) {
  const txid     = request.nextUrl.searchParams.get('txid')
  const chargeId = request.nextUrl.searchParams.get('chargeId')

  if (!txid && !chargeId) {
    return NextResponse.json({ error: 'txid ou chargeId obrigatório' }, { status: 400 })
  }

  // Look up by txid (PIX) or by chargeId prefixed with CHG- (card)
  const lookup = txid
    ? eq(sales.efi_txid, txid)
    : eq(sales.efi_txid, `CHG-${chargeId}`)

  const [sale] = await db.select().from(sales).where(lookup).limit(1)
  if (!sale) return NextResponse.json({ error: 'Cobrança não encontrada' }, { status: 404 })

  // For card, sync status with Efi if still pending
  if (sale.payment_method === 'card' && sale.payment_status === 'pending' && chargeId) {
    try {
      const efiCharge = await efiGetCardCharge(chargeId)
      if (efiCharge.status === 'paid') {
        // Webhook should have handled this, but sync just in case
        const now = new Date().toISOString()
        await db.update(sales)
          .set({ payment_status: 'paid', paid_at: now, updated_at: now })
          .where(eq(sales.id, sale.id))
        sale.payment_status = 'paid'
        sale.paid_at = now
      }
    } catch { /* Efi API unavailable — rely on webhook */ }
  }

  return NextResponse.json({
    status: sale.payment_status,
    paid: sale.payment_status === 'paid',
    paidAt: sale.paid_at,
    licenseKey: sale.payment_status === 'paid' ? sale.license_key : null,
  })
}
