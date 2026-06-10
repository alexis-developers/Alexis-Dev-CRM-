/**
 * Efi Bank — PIX API + Cobranças (Cartão) API helper
 * PIX docs:    https://dev.efipay.com.br/docs/api-pix/
 * Cobranças:   https://dev.efipay.com.br/docs/api-cobrancas/
 */

// ─── PIX API ─────────────────────────────────────────────────────────────────
const SANDBOX_URL = 'https://pix-h.api.efipay.com.br'
const PROD_URL    = 'https://pix.api.efipay.com.br'

function baseUrl() {
  return process.env.EFI_SANDBOX === 'true' ? SANDBOX_URL : PROD_URL
}

// ─── Cobranças API (cartão de crédito / boleto) ───────────────────────────────
const CARD_SANDBOX_URL = 'https://sandbox.gerencianet.com.br'
const CARD_PROD_URL    = 'https://api.gerencianet.com.br'

function cardBaseUrl() {
  return process.env.EFI_SANDBOX === 'true' ? CARD_SANDBOX_URL : CARD_PROD_URL
}

export async function efiGetCardToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.EFI_CLIENT_ID}:${process.env.EFI_CLIENT_SECRET}`
  ).toString('base64')

  const res = await fetch(`${cardBaseUrl()}/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  })
  if (!res.ok) throw new Error(`Efi card auth: ${await res.text()}`)
  const data = await res.json()
  return data.access_token as string
}

export interface EfiCardChargeData {
  charge_id: number
  status: string   // new | waiting | link | unpaid | paid | canceled | refunded
  link?: string
  custom_id?: string
}

// Create a card charge and return a hosted payment link
export async function efiCreateCardLink(params: {
  email: string
  name: string
  amount: number   // BRL, e.g. 710.00
  description: string
  saleId: string
  redirectUrl: string
}): Promise<{ chargeId: string; paymentLink: string }> {
  const token = await efiGetCardToken()
  const { email, name, amount, description, saleId, redirectUrl } = params
  const amountCentavos = Math.round(amount * 100)

  // 1. Create charge
  const chargeRes = await fetch(`${cardBaseUrl()}/v1/charge`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: [{ name: description, value: amountCentavos, amount: 1 }],
      metadata: {
        custom_id: saleId,
        notification_url: `${process.env.NEXT_PUBLIC_SITE_URL}/api/efi/webhook`,
      },
    }),
  })
  if (!chargeRes.ok) throw new Error(`Efi card charge: ${await chargeRes.text()}`)
  const chargeJson = await chargeRes.json()
  const chargeId: number = chargeJson.data.charge_id

  // 2. Associate customer (name + email — CPF is filled on Efi's hosted page)
  await fetch(`${cardBaseUrl()}/v1/charge/${chargeId}/customer`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, cpf: '00000000000' }), // CPF placeholder — user fills on Efi page
  }).catch(() => {}) // non-fatal

  // 3. Get payment link
  const expireAt = new Date(Date.now() + 24 * 3600_000).toISOString().split('T')[0]
  const linkRes = await fetch(`${cardBaseUrl()}/v1/charge/${chargeId}/link`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      payment_method: 'credit_card',
      billet_discount: 0,
      card_discount: 0,
      message: description,
      expire_at: expireAt,
      request_delivery_address: false,
      payment_types: ['credit_card'],
      redirect_url: redirectUrl,
    }),
  })
  if (!linkRes.ok) throw new Error(`Efi card link: ${await linkRes.text()}`)
  const linkJson = await linkRes.json()

  return { chargeId: String(chargeId), paymentLink: linkJson.data.link }
}

export async function efiGetCardCharge(chargeId: string): Promise<EfiCardChargeData> {
  const token = await efiGetCardToken()
  const res = await fetch(`${cardBaseUrl()}/v1/charge/${chargeId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Efi get card charge: ${await res.text()}`)
  const json = await res.json()
  return json.data as EfiCardChargeData
}

// Get OAuth2 token from Efi
export async function efiGetToken(): Promise<string> {
  const clientId     = process.env.EFI_CLIENT_ID!
  const clientSecret = process.env.EFI_CLIENT_SECRET!
  const credentials  = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(`${baseUrl()}/oauth/token`, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Efi auth failed: ${err}`)
  }

  const data = await res.json()
  return data.access_token as string
}

export interface EfiCharge {
  txid: string
  status: string
  valor: { original: string }
  calendario: { expiracao: number; criacao: string }
  chave: string
  pixCopiaECola?: string
  qrCode?: string         // base64 image (from /v2/loc/{id}/qrcode)
  loc?: { id: number; location: string; tipoCob: string }
}

// Create a PIX charge (cobrança imediata)
export async function efiCreateCharge(params: {
  email: string
  name: string
  amount: number          // in BRL, e.g. 680.00
  description: string
  expiresSeconds?: number // default 3600 (1h)
}): Promise<EfiCharge & { pixCopiaECola: string; qrCodeBase64: string }> {
  const token = await efiGetToken()
  const { email, name, amount, description, expiresSeconds = 3600 } = params
  const pixKey = process.env.EFI_PIX_KEY!

  // Generate a txid (alphanumeric, 26-35 chars)
  const txid = `ALX${Date.now()}${Math.random().toString(36).slice(2, 8).toUpperCase()}`

  const body = {
    calendario: { expiracao: expiresSeconds },
    devedor: { nome: name, email },
    valor: { original: amount.toFixed(2) },
    chave: pixKey,
    solicitacaoPagador: description,
    infoAdicionais: [
      { nome: 'Sistema', valor: 'Alexis CRM' },
    ],
  }

  const res = await fetch(`${baseUrl()}/v2/cob/${txid}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Efi charge failed: ${err}`)
  }

  const charge = await res.json() as EfiCharge

  // Get QR Code
  let pixCopiaECola = ''
  let qrCodeBase64  = ''

  if (charge.loc?.id) {
    const qrRes = await fetch(`${baseUrl()}/v2/loc/${charge.loc.id}/qrcode`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
    if (qrRes.ok) {
      const qrData = await qrRes.json()
      pixCopiaECola = qrData.pixCopiaECola ?? ''
      qrCodeBase64  = qrData.imagemQrcode ?? ''
    }
  }

  return { ...charge, pixCopiaECola, qrCodeBase64 }
}

// Query charge status
export async function efiGetCharge(txid: string): Promise<EfiCharge> {
  const token = await efiGetToken()
  const res = await fetch(`${baseUrl()}/v2/cob/${txid}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Efi get charge failed: ${await res.text()}`)
  return res.json()
}
