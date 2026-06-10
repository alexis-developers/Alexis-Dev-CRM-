import { NextResponse } from 'next/server'

const PRECO_BASE = 680.00

// Builds last 12 complete months in YYYYMM format (never future months)
function getLast12Months(): { start: string; end: string } {
  const now = new Date()
  const end = new Date(now.getFullYear(), now.getMonth() - 1, 1) // last complete month
  const start = new Date(end.getFullYear(), end.getMonth() - 11, 1) // 12 months back
  const fmt = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
  return { start: fmt(start), end: fmt(end) }
}

// GET /api/preco — retorna preço atualizado pelo IPCA + dólar
export async function GET() {
  try {
    const { start, end } = getLast12Months()

    // variavel 63 = IPCA Variação mensal (%) — agregado 1737
    const ipcaRes = await fetch(
      `https://servicodados.ibge.gov.br/api/v3/agregados/1737/periodos/${start}-${end}/variaveis/63?localidades=N1[all]`,
      { next: { revalidate: 86400 } }
    )

    let ipcaAcumulado = 0
    if (ipcaRes.ok) {
      const data = await ipcaRes.json()
      const serie: Record<string, string> = data?.[0]?.resultados?.[0]?.series?.[0]?.serie ?? {}
      // Compound accumulation of monthly IPCA values
      ipcaAcumulado = Object.values(serie).reduce((acc: number, v: string) => {
        const val = parseFloat(v) / 100
        if (!isFinite(val) || val > 0.5 || val < -0.1) return acc // sanity check: max 50% monthly
        return (1 + acc) * (1 + val) - 1
      }, 0)
    }

    // Cotação do dólar PTAX (BCB)
    const hoje = new Date()
    const dataStr = `${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}-${hoje.getFullYear()}`
    const dolarRes = await fetch(
      `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${dataStr}'&$format=json`,
      { next: { revalidate: 3600 } }
    )

    let cotacaoDolar = 0
    if (dolarRes.ok) {
      const dolarData = await dolarRes.json()
      cotacaoDolar = dolarData?.value?.[0]?.cotacaoVenda ?? 0
    }

    const DOLAR_BASE = 5.00
    const variacaoDolar = cotacaoDolar > 0 ? (cotacaoDolar - DOLAR_BASE) / DOLAR_BASE : 0
    const reajuste = (ipcaAcumulado * 0.5) + (variacaoDolar * 0.5)
    const precoAjustado = PRECO_BASE * (1 + Math.max(0, reajuste))
    const precoFinal = Math.ceil(precoAjustado / 10) * 10

    return NextResponse.json({
      preco_base: PRECO_BASE,
      preco_atual: precoFinal,
      preco_mensal: parseFloat((precoFinal / 12).toFixed(2)),
      ipca_acumulado_pct: parseFloat((ipcaAcumulado * 100).toFixed(2)),
      cotacao_dolar: cotacaoDolar || null,
      reajuste_pct: parseFloat((reajuste * 100).toFixed(2)),
      moeda: 'BRL',
      updated_at: new Date().toISOString(),
    })
  } catch {
    return NextResponse.json({
      preco_base: PRECO_BASE,
      preco_atual: PRECO_BASE,
      preco_mensal: parseFloat((PRECO_BASE / 12).toFixed(2)),
      ipca_acumulado_pct: 0,
      cotacao_dolar: null,
      reajuste_pct: 0,
      moeda: 'BRL',
      updated_at: new Date().toISOString(),
      fallback: true,
    })
  }
}
