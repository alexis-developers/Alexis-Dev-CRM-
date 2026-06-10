// Email HTML templates for Alexis CRM

const BRAND = '#7C3AED' // violet-600

function layout(content: string) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    body{font-family:Arial,sans-serif;background:#0F172A;margin:0;padding:0}
    .wrap{max-width:560px;margin:40px auto;background:#1E293B;border-radius:16px;overflow:hidden;border:1px solid #334155}
    .header{background:linear-gradient(135deg,#1E1B4B,#312E81);padding:32px;text-align:center}
    .header h1{color:#fff;font-size:24px;margin:0;font-weight:800;letter-spacing:-0.5px}
    .header p{color:#C4B5FD;font-size:13px;margin:8px 0 0}
    .body{padding:32px}
    .body p{color:#CBD5E1;font-size:14px;line-height:1.7;margin:0 0 16px}
    .key-box{background:#0F172A;border:2px dashed #7C3AED;border-radius:12px;padding:20px;text-align:center;margin:24px 0}
    .key-box .key{font-family:monospace;font-size:20px;font-weight:bold;color:#A78BFA;letter-spacing:3px;word-break:break-all}
    .key-box p{color:#94A3B8;font-size:12px;margin:8px 0 0}
    .btn{display:inline-block;background:${BRAND};color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin:8px 0}
    .btn-outline{display:inline-block;border:2px solid ${BRAND};color:#A78BFA;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px}
    .info-row{background:#0F172A;border-radius:8px;padding:12px 16px;margin:8px 0;display:flex;justify-content:space-between}
    .info-row .label{color:#64748B;font-size:12px}
    .info-row .value{color:#E2E8F0;font-size:13px;font-weight:600}
    .footer{border-top:1px solid #334155;padding:20px 32px;text-align:center}
    .footer p{color:#475569;font-size:11px;margin:0}
    .badge{display:inline-block;background:#14532D;color:#4ADE80;border-radius:20px;padding:4px 12px;font-size:12px;font-weight:700;margin-bottom:16px}
    .badge-warn{background:#422006;color:#FCD34D}
    .badge-red{background:#450A0A;color:#FCA5A5}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>Alexis CRM</h1>
      <p>High Performance WA Solutions</p>
    </div>
    <div class="body">${content}</div>
    <div class="footer">
      <p>Alexis CRM · Não responda este email · <a href="mailto:pastoralexdocavaco@gmail.com" style="color:#7C3AED">Suporte</a></p>
    </div>
  </div>
</body>
</html>`
}

export function templateLicenseKey(params: {
  companyName: string
  key: string
  role: string
  signupUrl: string
  expiresAt: string
}) {
  const { companyName, key, role, signupUrl, expiresAt } = params
  const expires = new Date(expiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return layout(`
    <div class="badge">✅ Pagamento Confirmado</div>
    <p>Olá, <strong style="color:#E2E8F0">${companyName}</strong>!</p>
    <p>Seu pagamento foi confirmado e sua <strong>Licença OEM Alexis CRM</strong> está pronta. Guarde a chave abaixo com segurança — ela é necessária para ativar sua conta.</p>

    <div class="key-box">
      <div class="key">${key}</div>
      <p>Chave válida até ${expires} · Nível: ${role === 'admin' ? 'Admin' : 'Agente'}</p>
    </div>

    <p style="margin-bottom:8px"><strong style="color:#E2E8F0">Como ativar:</strong></p>
    <p>1. Acesse o link abaixo<br/>2. Insira a chave acima no campo "Chave de Licença"<br/>3. Crie sua senha e pronto!</p>

    <div style="text-align:center;margin:24px 0">
      <a href="${signupUrl}" class="btn">→ Ativar minha licença</a>
    </div>

    <div class="info-row">
      <span class="label">Licença expira em</span>
      <span class="value">${expires}</span>
    </div>
    <div class="info-row">
      <span class="label">Suporte</span>
      <span class="value">pastoralexdocavaco@gmail.com</span>
    </div>

    <p style="margin-top:24px;font-size:12px;color:#64748B">Dúvidas? Responda este email ou fale pelo WhatsApp de suporte.</p>
  `)
}

export function templateRenewalReminder(params: {
  companyName: string
  daysLeft: number
  expiresAt: string
  renewalUrl: string
  price: number
}) {
  const { companyName, daysLeft, expiresAt, renewalUrl, price } = params
  const expires = new Date(expiresAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const urgent = daysLeft <= 7
  const badge = urgent
    ? `<div class="badge badge-red">⚠️ Urgente: ${daysLeft} dia(s) restante(s)</div>`
    : `<div class="badge badge-warn">⏰ ${daysLeft} dias para vencer</div>`

  return layout(`
    ${badge}
    <p>Olá, <strong style="color:#E2E8F0">${companyName}</strong>!</p>
    <p>Sua licença do <strong>Alexis CRM</strong> ${urgent ? '<strong style="color:#FCA5A5">expira em breve</strong>' : 'está próxima do vencimento'}.</p>

    <div class="info-row">
      <span class="label">Vencimento</span>
      <span class="value">${expires}</span>
    </div>
    <div class="info-row">
      <span class="label">Dias restantes</span>
      <span class="value" style="color:${urgent ? '#FCA5A5' : '#FCD34D'}">${daysLeft} dia(s)</span>
    </div>
    <div class="info-row">
      <span class="label">Valor da renovação</span>
      <span class="value">R$ ${price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/ano</span>
    </div>

    <p style="margin-top:20px">Renove agora para garantir acesso contínuo. Seus dados estão seguros — a renovação apenas estende o prazo por mais 1 ano.</p>

    <div style="text-align:center;margin:24px 0">
      <a href="${renewalUrl}" class="btn">Renovar agora</a>
    </div>
    <p style="font-size:12px;color:#64748B;text-align:center">Ou entre em contato: pastoralexdocavaco@gmail.com</p>
  `)
}

export function templateRenewalExpired(params: {
  companyName: string
  renewalUrl: string
  price: number
}) {
  const { companyName, renewalUrl, price } = params
  return layout(`
    <div class="badge badge-red">🔒 Licença Expirada</div>
    <p>Olá, <strong style="color:#E2E8F0">${companyName}</strong>!</p>
    <p>Sua licença do <strong>Alexis CRM</strong> expirou. Seu acesso está suspenso, mas <strong style="color:#4ADE80">todos os seus dados estão seguros</strong> e intactos.</p>

    <div class="info-row">
      <span class="label">Renovação anual</span>
      <span class="value">R$ ${price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
    </div>

    <p style="margin-top:16px">Após o pagamento, você recebe uma nova chave de licença por email e o acesso é restaurado imediatamente — sem perda de dados.</p>

    <div style="text-align:center;margin:24px 0">
      <a href="${renewalUrl}" class="btn">Renovar licença agora</a>
    </div>

    <p style="font-size:12px;color:#64748B;text-align:center">Dúvidas? Fale pelo <a href="https://wa.me/${process.env.CONTACT_WHATSAPP ?? ''}" style="color:#7C3AED">WhatsApp</a></p>
  `)
}

export function templatePaymentConfirmed(params: {
  companyName: string
  amount: number
  txid: string
}) {
  const { companyName, amount, txid } = params
  return layout(`
    <div class="badge">✅ Pagamento Recebido</div>
    <p>Olá, <strong style="color:#E2E8F0">${companyName}</strong>!</p>
    <p>Seu pagamento PIX foi confirmado! Em instantes você receberá outro email com sua <strong>chave de licença</strong>.</p>

    <div class="info-row">
      <span class="label">Valor pago</span>
      <span class="value">R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
    </div>
    <div class="info-row">
      <span class="label">ID da transação</span>
      <span class="value" style="font-family:monospace;font-size:11px">${txid}</span>
    </div>

    <p style="margin-top:16px;font-size:12px;color:#64748B">Guarde este email como comprovante do pagamento.</p>
  `)
}
