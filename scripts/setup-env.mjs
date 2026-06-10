import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { exec } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const colors = {
  reset: '\x1b[0m', bright: '\x1b[1m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[34m', cyan: '\x1b[36m', red: '\x1b[31m',
};
const rl = readline.createInterface({ input, output });

async function ask(question, defaultValue = '') {
  const answer = await rl.question(`${colors.bright}${colors.cyan}?${colors.reset} ${question} ${defaultValue ? `(${colors.yellow}${defaultValue}${colors.reset}) ` : ''}`);
  return answer.trim() || defaultValue;
}

function base64url(str) {
  return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function createJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(`${encodedHeader}.${encodedPayload}`).digest('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function main() {
  console.clear();
  console.log(`${colors.bright}${colors.green}👨‍🏫 Olá! Sou o Agente Professor do WA-CRM.${colors.reset}`);
  console.log(`Vou te guiar passo a passo na instalação e configuração do seu sistema.\n`);

  const envLocalPath = path.resolve(process.cwd(), '.env.local');
  const supaEnvPath = path.resolve(process.cwd(), 'supabase-infra', '.env');
  const supaExamplePath = path.resolve(process.cwd(), 'supabase-infra', '.env.example');

  if (!fs.existsSync(supaExamplePath)) {
    console.error(`${colors.red}Erro: Arquivo supabase-infra/.env.example não encontrado!${colors.reset}`);
    process.exit(1);
  }

  // AULA 1: O Servidor
  console.log(`${colors.bright}${colors.blue}=== PASSO 1: O Endereço do seu Sistema ===${colors.reset}`);
  console.log(`Para que o WhatsApp consiga enviar as mensagens de volta para o seu CRM (Webhooks),`);
  console.log(`precisamos definir qual será o endereço de acesso deste servidor.`);
  console.log(`${colors.yellow}Dica: Se estiver instalando na VPS final, use o IP da máquina ou o domínio (ex: meucrm.com.br).${colors.reset}`);
  console.log(`Se estiver testando no seu computador, basta apertar Enter para usar o localhost.\n`);
  
  const serverIp = await ask('Qual o IP ou Domínio deste servidor?', 'localhost');

  // AULA 2: O Banco de Dados e Segurança
  console.log(`\n${colors.bright}${colors.blue}=== PASSO 2: Segurança Automática ===${colors.reset}`);
  console.log(`Antigamente, as pessoas precisavam acessar vários sites para gerar senhas.`);
  console.log(`Como sou seu assistente, ${colors.cyan}eu mesmo vou gerar senhas seguras e chaves criptográficas${colors.reset} agora.`);
  console.log(`Isso inclui o Banco de Dados Postgres e os tokens JWT do Supabase.\n`);
  
  await ask('Pressione Enter para eu gerar as chaves e configurar seus arquivos...');
  
  // Generate random secrets
  const postgresPassword = crypto.randomBytes(24).toString('hex');
  const jwtSecret = crypto.randomBytes(32).toString('hex');
  const wacrmEncryptionKey = crypto.randomBytes(32).toString('hex');
  const cronSecret = crypto.randomBytes(16).toString('hex');

  // Generate JWT tokens based on the JWT_SECRET
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + (10 * 365 * 24 * 60 * 60); // 10 years

  const anonKey = createJWT({ role: 'anon', iss: 'supabase', iat, exp }, jwtSecret);
  const serviceRoleKey = createJWT({ role: 'service_role', iss: 'supabase', iat, exp }, jwtSecret);

  // 1. Setup supabase-infra/.env
  let supaEnvContent = fs.readFileSync(supaExamplePath, 'utf-8');
  supaEnvContent = supaEnvContent.replace(/POSTGRES_PASSWORD=.*/g, `POSTGRES_PASSWORD=${postgresPassword}`);
  supaEnvContent = supaEnvContent.replace(/JWT_SECRET=.*/g, `JWT_SECRET=${jwtSecret}`);
  supaEnvContent = supaEnvContent.replace(/ANON_KEY=.*/g, `ANON_KEY=${anonKey}`);
  supaEnvContent = supaEnvContent.replace(/SERVICE_ROLE_KEY=.*/g, `SERVICE_ROLE_KEY=${serviceRoleKey}`);
  
  const siteUrl = serverIp.startsWith('http') ? serverIp : `http://${serverIp}:3000`;
  const apiExternalUrl = serverIp.startsWith('http') ? serverIp.replace(':3000', ':8000') : `http://${serverIp}:8000`;
  
  supaEnvContent = supaEnvContent.replace(/SITE_URL=.*/g, `SITE_URL=${siteUrl}`);
  supaEnvContent = supaEnvContent.replace(/SUPABASE_PUBLIC_URL=.*/g, `SUPABASE_PUBLIC_URL=${apiExternalUrl}`);
  supaEnvContent = supaEnvContent.replace(/API_EXTERNAL_URL=.*/g, `API_EXTERNAL_URL=${apiExternalUrl}`);

  fs.writeFileSync(supaEnvPath, supaEnvContent);

  // 2. Setup wacrm/.env.local
  const nextEnvContent = `# Supabase
NEXT_PUBLIC_SUPABASE_URL=${apiExternalUrl}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${anonKey}
SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}

# WhatsApp
ENCRYPTION_KEY=${wacrmEncryptionKey}
META_APP_SECRET=COLE_SEU_APP_SECRET_AQUI

# Settings
NEXT_PUBLIC_SITE_URL=${siteUrl}
AUTOMATION_CRON_SECRET=${cronSecret}
`;

  fs.writeFileSync(envLocalPath, nextEnvContent);

  console.log(`${colors.bright}${colors.green}✅ Configurações e senhas injetadas com sucesso!${colors.reset}`);
  
  console.log(`\n${colors.bright}${colors.blue}=== PASSO 3: Configurando a Meta (WhatsApp) ===${colors.reset}`);
  console.log(`Por questões de segurança, eu não pedi sua senha da Meta aqui na tela.`);
  console.log(`Mas você precisará configurá-la depois para o WhatsApp funcionar. Anote os passos:`);
  console.log(`  1. Acesse: ${colors.cyan}https://developers.facebook.com${colors.reset}`);
  console.log(`  2. Vá em ${colors.yellow}Meus Aplicativos${colors.reset}. Se for cliente novo, clique em ${colors.green}"Criar Aplicativo"${colors.reset} (tipo: Empresa).`);
  console.log(`  3. Após criar ou selecionar seu App, vá no menu lateral em: ${colors.yellow}Configurações -> Básico${colors.reset}`);
  console.log(`  4. Clique em "Mostrar" no campo "Chave Secreta do Aplicativo" (App Secret) e copie.`);
  console.log(`  5. Abra o arquivo ${colors.bright}.env.local${colors.reset} na pasta deste projeto.`);
  console.log(`  6. Cole o código na linha: ${colors.cyan}META_APP_SECRET=COLE_SEU_APP_SECRET_AQUI${colors.reset}\n`);

  await ask('Pressione Enter quando tiver entendido os passos do WhatsApp...');
  rl.close();

  console.log(`\n${colors.bright}${colors.blue}=== PASSO 4: Ligando os Motores (Docker) ===${colors.reset}`);
  console.log(`${colors.cyan}🐳 Subindo toda a infraestrutura do Supabase e WA-CRM... Isso vai demorar alguns minutos na primeira vez.${colors.reset}\n`);

  // Start Supabase Infra first
  const supaProcess = exec('docker compose -f supabase-infra/docker-compose.yml up -d');
  supaProcess.stdout.pipe(process.stdout);
  supaProcess.stderr.pipe(process.stderr);

  supaProcess.on('exit', (code) => {
    if (code === 0) {
      console.log(`\n${colors.green}✅ Supabase iniciado! Agora iniciando o WA-CRM...${colors.reset}\n`);
      const wacrmProcess = exec('docker compose up -d --build');
      wacrmProcess.stdout.pipe(process.stdout);
      wacrmProcess.stderr.pipe(process.stderr);

      wacrmProcess.on('exit', (waCode) => {
        if (waCode === 0) {
          console.log(`\n${colors.bright}${colors.green}🚀 TUDO PRONTO! O sistema está no ar!${colors.reset}`);
          console.log(`WA-CRM: ${colors.cyan}${siteUrl}${colors.reset}`);
          console.log(`API do Supabase: ${colors.cyan}${apiExternalUrl}${colors.reset}\n`);
        }
      });
    } else {
      console.log(`\n${colors.red}⚠️ Erro ao iniciar a infra do Supabase.${colors.reset}\n`);
    }
  });
}

main().catch(err => {
  console.error(`\n${colors.red}Erro fatal:${colors.reset}`, err);
  process.exit(1);
});
