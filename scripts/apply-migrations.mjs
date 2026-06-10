import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

function runSql(sqlContent) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', 'supabase-db', 'psql', '-U', 'postgres', '-d', 'postgres'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Exit code ${code}. Stderr: ${stderr}`));
      }
    });

    child.stdin.write(sqlContent);
    child.stdin.end();
  });
}

async function main() {
  console.log(`${colors.bright}${colors.blue}=== Aplicando Migrações do Banco de Dados ===${colors.reset}\n`);

  const migrationsDir = path.resolve(process.cwd(), 'supabase', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    console.error(`${colors.red}Erro: Diretório de migrações não encontrado em ${migrationsDir}${colors.reset}`);
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log(`${colors.yellow}Nenhum arquivo de migração encontrado.${colors.reset}`);
    return;
  }

  console.log(`Encontrados ${files.length} arquivos de migração.`);

  for (const file of files) {
    console.log(`\nAplicando ${colors.cyan}${file}${colors.reset}...`);
    const filePath = path.join(migrationsDir, file);
    const sqlContent = fs.readFileSync(filePath, 'utf-8');

    try {
      await runSql(sqlContent);
      console.log(`${colors.green}✓ Sucesso${colors.reset}`);
    } catch (err) {
      console.error(`${colors.red}✗ Falha ao aplicar ${file}:${colors.reset}`);
      console.error(err.message);
      process.exit(1);
    }
  }

  console.log(`\n${colors.bright}${colors.green}✓ Todas as migrações foram aplicadas com sucesso!${colors.reset}`);

  console.log(`\n${colors.cyan}Recarregando o cache do PostgREST...${colors.reset}`);
  
  await new Promise((resolve) => {
    const child = spawn('docker', ['restart', 'supabase-rest'], { stdio: 'inherit' });
    child.on('close', resolve);
  });

  console.log(`\n${colors.bright}${colors.green}🚀 Banco de dados totalmente inicializado!${colors.reset}\n`);
}

main().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});
