# =============================================================================
#  Alexis CRM — Deploy por Cliente no Cloudflare (PowerShell)
# =============================================================================
#  USO:
#    .\scripts\deploy-client.ps1 -Email "empresa@dominio.com" -Nome "Empresa XYZ"
# =============================================================================

param(
    [Parameter(Mandatory=$true)]
    [string]$Email,
    [string]$Nome = "Cliente"
)

# Slug seguro para Cloudflare
$Slug = $Email -replace '@', '-' -replace '\.', '-' -replace '[^a-zA-Z0-9-]', '' | ForEach-Object { $_.ToLower() }
$DbName = "crm-$Slug"
$R2Name = "crm-$Slug-files"
$PagesProject = "crm-$Slug"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  Alexis CRM — Novo Cliente" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  E-mail  : $Email"
Write-Host "  Empresa : $Nome"
Write-Host "  Slug    : $Slug"
Write-Host "  D1      : $DbName"
Write-Host "  R2      : $R2Name"
Write-Host "  Pages   : $PagesProject"
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Criar D1 Database
Write-Host "Criando D1 database: $DbName..." -ForegroundColor Yellow
$d1Output = npx wrangler d1 create $DbName 2>&1
Write-Host $d1Output

# Extrai database_id
$dbId = ($d1Output | Select-String 'database_id\s*=\s*"([^"]+)"').Matches.Groups[1].Value
if (-not $dbId) { $dbId = "SUBSTITUA-PELO-DATABASE-ID" }
Write-Host "D1 criado: $DbName (id: $dbId)" -ForegroundColor Green

# 2. Criar R2 Bucket
Write-Host ""
Write-Host "Criando R2 bucket: $R2Name..." -ForegroundColor Yellow
npx wrangler r2 bucket create $R2Name 2>&1
Write-Host "R2 bucket criado: $R2Name" -ForegroundColor Green

# 3. Gerar wrangler config do cliente
$wranglerFile = "wrangler.$Slug.toml"
Write-Host ""
Write-Host "Gerando $wranglerFile..." -ForegroundColor Yellow

$tomlContent = @"
# =====================================================================
#  Alexis CRM — Cliente: $Nome ($Email)
#  Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# =====================================================================
name = "$PagesProject"
compatibility_date = "2025-01-01"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = ".vercel/output/static"

[[d1_databases]]
binding = "DB"
database_name = "$DbName"
database_id = "$dbId"

[[r2_buckets]]
binding = "FILES"
bucket_name = "$R2Name"

[vars]
TENANT_EMAIL = "$Email"
TENANT_NAME = "$Nome"
"@

Set-Content -Path $wranglerFile -Value $tomlContent -Encoding UTF8
Write-Host "$wranglerFile gerado!" -ForegroundColor Green

# 4. Build
Write-Host ""
Write-Host "Fazendo build para Cloudflare Pages..." -ForegroundColor Yellow
npx @cloudflare/next-on-pages 2>&1

# 5. Deploy
Write-Host ""
Write-Host "Fazendo deploy..." -ForegroundColor Yellow
npx wrangler pages deploy .vercel/output/static --project-name $PagesProject --config $wranglerFile 2>&1

# 6. Resumo
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  Cliente provisionado com sucesso!" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green
Write-Host "  D1 Database : $DbName"
Write-Host "  R2 Bucket   : $R2Name"
Write-Host "  Pages URL   : https://$PagesProject.pages.dev" -ForegroundColor Cyan
Write-Host "  Config file : $wranglerFile"
Write-Host ""
Write-Host "  Proximos passos:"
Write-Host "  1. Acesse https://$PagesProject.pages.dev/signup"
Write-Host "  2. O primeiro cadastro vira Super Admin automaticamente"
Write-Host "  3. Distribua chaves de licenca em Configuracoes -> Licencas OEM"
Write-Host "============================================================" -ForegroundColor Green
