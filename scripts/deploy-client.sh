#!/usr/bin/env bash
# =============================================================================
#  Alexis CRM — Deploy por Cliente no Cloudflare
# =============================================================================
#  Cria um ambiente isolado para um novo cliente:
#    - D1 Database:  crm-[slug-do-email]
#    - R2 Bucket:    crm-[slug-do-email]-files
#    - Pages Project: crm-[slug-do-email]
#
#  USO:
#    ./scripts/deploy-client.sh "empresa@dominio.com" "Nome da Empresa"
#
#  PRÉ-REQUISITOS:
#    - wrangler instalado e autenticado (wrangler login)
#    - Cloudflare Account ID em CLOUDFLARE_ACCOUNT_ID
# =============================================================================

set -e

EMAIL="${1:-}"
NOME="${2:-Cliente}"

if [ -z "$EMAIL" ]; then
  echo "❌  Uso: $0 <email-do-cliente> [nome-da-empresa]"
  echo "    Ex: $0 empresa@cliente.com 'Empresa XYZ'"
  exit 1
fi

# Slug: converte email em nome seguro para recursos Cloudflare
# ex: empresa@cliente.com → empresa-cliente-com
SLUG=$(echo "$EMAIL" | sed 's/@/-/g' | sed 's/\./-/g' | tr '[:upper:]' '[:lower:]')
DB_NAME="crm-${SLUG}"
R2_NAME="crm-${SLUG}-files"
PAGES_PROJECT="crm-${SLUG}"

echo ""
echo "============================================================"
echo "  🚀  Alexis CRM — Novo Cliente"
echo "============================================================"
echo "  E-mail  : $EMAIL"
echo "  Empresa : $NOME"
echo "  Slug    : $SLUG"
echo "  D1      : $DB_NAME"
echo "  R2      : $R2_NAME"
echo "  Pages   : $PAGES_PROJECT"
echo "============================================================"
echo ""

# ─── 1. Criar D1 Database ────────────────────────────────────────────────────
echo "📦  Criando D1 database: $DB_NAME..."
D1_OUTPUT=$(npx wrangler d1 create "$DB_NAME" 2>&1)
echo "$D1_OUTPUT"

# Extrai o database_id do output
DB_ID=$(echo "$D1_OUTPUT" | grep -oP '(?<=database_id = ")([^"]+)' || true)
if [ -z "$DB_ID" ]; then
  # tenta outro formato
  DB_ID=$(echo "$D1_OUTPUT" | grep 'database_id' | awk -F'"' '{print $2}' || true)
fi

if [ -z "$DB_ID" ]; then
  echo "⚠️   Não foi possível extrair o database_id automaticamente."
  echo "    Verifique o output acima e atualize o wrangler.toml manualmente."
  DB_ID="SUBSTITUA-PELO-DATABASE-ID"
fi

echo "✅  D1 criado: $DB_NAME (id: $DB_ID)"

# ─── 2. Criar R2 Bucket ──────────────────────────────────────────────────────
echo ""
echo "📦  Criando R2 bucket: $R2_NAME..."
npx wrangler r2 bucket create "$R2_NAME" 2>&1 || true
echo "✅  R2 bucket: $R2_NAME"

# ─── 3. Gerar wrangler.toml específico do cliente ────────────────────────────
WRANGLER_CLIENT="wrangler.${SLUG}.toml"
echo ""
echo "📝  Gerando $WRANGLER_CLIENT..."

cat > "$WRANGLER_CLIENT" <<TOML
# =====================================================================
#  Alexis CRM — Cliente: $NOME ($EMAIL)
#  Gerado em: $(date '+%Y-%m-%d %H:%M:%S')
# =====================================================================
name = "$PAGES_PROJECT"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".vercel/output/static"

[[d1_databases]]
binding = "DB"
database_name = "$DB_NAME"
database_id = "$DB_ID"

[[r2_buckets]]
binding = "FILES"
bucket_name = "$R2_NAME"

[vars]
TENANT_EMAIL = "$EMAIL"
TENANT_NAME = "$NOME"
TOML

echo "✅  $WRANGLER_CLIENT gerado"

# ─── 4. Aplicar schema D1 ────────────────────────────────────────────────────
echo ""
echo "🗄️   Aplicando schema no D1 $DB_NAME..."
# Gera SQL do schema via drizzle-kit
npx drizzle-kit generate --config drizzle.config.ts 2>/dev/null || true

# Aplica migrations se existirem
if ls drizzle/*.sql 2>/dev/null 1>/dev/null; then
  for sql_file in drizzle/*.sql; do
    echo "   Aplicando: $sql_file"
    npx wrangler d1 execute "$DB_NAME" --file="$sql_file" 2>&1 || true
  done
else
  echo "   (nenhuma migration encontrada — execute db:push manualmente)"
fi

# ─── 5. Deploy no Cloudflare Pages ───────────────────────────────────────────
echo ""
echo "🌐  Fazendo build e deploy no Cloudflare Pages..."
echo "    Projeto: $PAGES_PROJECT"

# Build Next.js para Cloudflare Pages
echo "   Building..."
npx @cloudflare/next-on-pages 2>&1 || {
  echo "⚠️  Build falhou. Verifique os erros acima."
  echo "   Execute manualmente: npx @cloudflare/next-on-pages && npx wrangler pages deploy .vercel/output/static --project-name $PAGES_PROJECT"
}

# Deploy
npx wrangler pages deploy .vercel/output/static \
  --project-name "$PAGES_PROJECT" \
  --config "$WRANGLER_CLIENT" 2>&1 || {
  echo "⚠️  Deploy falhou. Tente manualmente:"
  echo "   npx wrangler pages deploy .vercel/output/static --project-name $PAGES_PROJECT --config $WRANGLER_CLIENT"
}

# ─── 6. Resumo final ─────────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo "  ✅  Cliente provisionado com sucesso!"
echo "============================================================"
echo "  D1 Database : $DB_NAME"
echo "  R2 Bucket   : $R2_NAME"
echo "  Pages URL   : https://${PAGES_PROJECT}.pages.dev"
echo "  Config file : $WRANGLER_CLIENT"
echo ""
echo "  Próximos passos:"
echo "  1. Acesse https://${PAGES_PROJECT}.pages.dev/signup"
echo "  2. O primeiro cadastro vira Super Admin automaticamente"
echo "  3. Distribua chaves de licença em Configurações → Licenças OEM"
echo "============================================================"
