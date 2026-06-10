/**
 * Initializes the local SQLite database and creates the first admin user.
 * Run with: node scripts/init-db.mjs
 */
import Database from 'better-sqlite3'
import { randomUUID } from 'crypto'
import { createHash, randomBytes } from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', 'local.db')

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ─── Create all tables ────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS "user" (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    email_verified INTEGER NOT NULL DEFAULT 0,
    image TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    expires_at TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    access_token TEXT,
    refresh_token TEXT,
    id_token TEXT,
    access_token_expires_at TEXT,
    refresh_token_expires_at TEXT,
    scope TEXT,
    password TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    full_name TEXT,
    email TEXT NOT NULL,
    avatar_url TEXT,
    role TEXT DEFAULT 'agent',
    is_super_admin INTEGER DEFAULT 0,
    must_change_password INTEGER DEFAULT 0,
    ativo INTEGER DEFAULT 1,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    phone TEXT,
    name TEXT,
    email TEXT,
    company TEXT,
    avatar_url TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS contact_tags (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE(contact_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS custom_fields (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    field_type TEXT DEFAULT 'text',
    field_options TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS contact_custom_values (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    custom_field_id TEXT NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
    value TEXT,
    UNIQUE(contact_id, custom_field_id)
  );

  CREATE TABLE IF NOT EXISTS contact_notes (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    note_text TEXT NOT NULL,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'open',
    assigned_agent_id TEXT,
    last_message_text TEXT,
    last_message_at TEXT,
    unread_count INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_type TEXT NOT NULL,
    sender_id TEXT,
    content_type TEXT NOT NULL DEFAULT 'text',
    content_text TEXT,
    media_url TEXT,
    template_name TEXT,
    message_id TEXT,
    status TEXT DEFAULT 'sent',
    reply_to_message_id TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS message_reactions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    conversation_id TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    actor_id TEXT,
    emoji TEXT NOT NULL,
    created_at TEXT,
    UNIQUE(message_id, actor_type, actor_id)
  );

  CREATE TABLE IF NOT EXISTS whatsapp_config (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    phone_number_id TEXT,
    waba_id TEXT,
    access_token TEXT,
    verify_token TEXT,
    status TEXT DEFAULT 'disconnected',
    connected_at TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS message_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    language TEXT DEFAULT 'en_US',
    header_type TEXT,
    header_content TEXT,
    body_text TEXT NOT NULL,
    footer_text TEXT,
    buttons TEXT,
    status TEXT DEFAULT 'Draft',
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS pipelines (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS pipeline_stages (
    id TEXT PRIMARY KEY,
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    color TEXT DEFAULT '#3b82f6',
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS deals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    pipeline_id TEXT NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    stage_id TEXT NOT NULL,
    contact_id TEXT,
    conversation_id TEXT,
    assigned_to TEXT,
    title TEXT NOT NULL,
    value REAL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    notes TEXT,
    expected_close_date TEXT,
    status TEXT DEFAULT 'open',
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS broadcasts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    template_name TEXT NOT NULL,
    template_language TEXT DEFAULT 'en_US',
    template_variables TEXT,
    audience_filter TEXT,
    scheduled_at TEXT,
    status TEXT DEFAULT 'draft',
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    delivered_count INTEGER DEFAULT 0,
    read_count INTEGER DEFAULT 0,
    replied_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS broadcast_recipients (
    id TEXT PRIMARY KEY,
    broadcast_id TEXT NOT NULL REFERENCES broadcasts(id) ON DELETE CASCADE,
    contact_id TEXT,
    status TEXT DEFAULT 'pending',
    whatsapp_message_id TEXT UNIQUE,
    sent_at TEXT,
    delivered_at TEXT,
    read_at TEXT,
    replied_at TEXT,
    error_message TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS automations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    trigger_type TEXT NOT NULL,
    trigger_config TEXT,
    is_active INTEGER DEFAULT 0,
    execution_count INTEGER DEFAULT 0,
    last_executed_at TEXT,
    created_at TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS automation_steps (
    id TEXT PRIMARY KEY,
    automation_id TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    parent_step_id TEXT,
    branch TEXT,
    step_type TEXT NOT NULL,
    step_config TEXT,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS automation_logs (
    id TEXT PRIMARY KEY,
    automation_id TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    contact_id TEXT,
    trigger_event TEXT NOT NULL,
    steps_executed TEXT,
    status TEXT NOT NULL DEFAULT 'success',
    error_message TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS automation_pending_executions (
    id TEXT PRIMARY KEY,
    automation_id TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    contact_id TEXT,
    log_id TEXT REFERENCES automation_logs(id) ON DELETE CASCADE,
    parent_step_id TEXT,
    branch TEXT,
    next_step_position INTEGER,
    context TEXT,
    status TEXT DEFAULT 'pending',
    run_at TEXT NOT NULL,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS feeds (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'manual',
    categoria TEXT NOT NULL DEFAULT 'outros',
    autor_id TEXT,
    autor_tipo TEXT NOT NULL DEFAULT 'usuario',
    titulo TEXT NOT NULL,
    conteudo TEXT NOT NULL,
    entidade_relacionada_tipo TEXT,
    entidade_relacionada_id TEXT,
    acao_realizada TEXT,
    visibilidade TEXT DEFAULT 'publico',
    departamento_id TEXT,
    anexos TEXT DEFAULT '[]',
    mencoes TEXT DEFAULT '[]',
    tags TEXT DEFAULT '[]',
    metadados TEXT,
    fixado INTEGER DEFAULT 0,
    editado INTEGER DEFAULT 0,
    editado_em TEXT,
    criado_em TEXT,
    atualizado_em TEXT,
    excluido_em TEXT
  );

  CREATE TABLE IF NOT EXISTS feed_comentarios (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    comentario_pai_id TEXT,
    autor_id TEXT,
    conteudo TEXT NOT NULL,
    anexos TEXT DEFAULT '[]',
    mencoes TEXT DEFAULT '[]',
    editado INTEGER DEFAULT 0,
    criado_em TEXT,
    atualizado_em TEXT,
    excluido_em TEXT
  );

  CREATE TABLE IF NOT EXISTS feed_reacoes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    feed_id TEXT,
    comentario_id TEXT,
    usuario_id TEXT NOT NULL,
    tipo_reacao TEXT NOT NULL,
    criado_em TEXT,
    UNIQUE(usuario_id, feed_id, comentario_id)
  );

  CREATE TABLE IF NOT EXISTS feed_visualizacoes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    usuario_id TEXT NOT NULL,
    visualizado_em TEXT,
    UNIQUE(feed_id, usuario_id)
  );

  CREATE TABLE IF NOT EXISTS feed_preferencias_usuario (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    usuario_id TEXT NOT NULL,
    categorias_silenciadas TEXT DEFAULT '[]',
    notificar_mencoes INTEGER DEFAULT 1,
    notificar_respostas INTEGER DEFAULT 1,
    notificar_reacoes INTEGER DEFAULT 0,
    frequencia_resumo_email TEXT DEFAULT 'nunca',
    UNIQUE(user_id, usuario_id)
  );

  CREATE TABLE IF NOT EXISTS feed_compartilhamentos (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    feed_original_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    usuario_id TEXT NOT NULL,
    comentario_compartilhamento TEXT,
    criado_em TEXT
  );

  CREATE TABLE IF NOT EXISTS user_permissions (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    module_name TEXT NOT NULL,
    can_view INTEGER DEFAULT 1,
    can_create INTEGER DEFAULT 0,
    can_edit INTEGER DEFAULT 0,
    can_delete INTEGER DEFAULT 0,
    created_at TEXT,
    updated_at TEXT,
    UNIQUE(profile_id, module_name)
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    description TEXT,
    created_at TEXT
  );
`)

// ─── Create admin user if none exists ─────────────────────────────────────────
const existingUser = db.prepare('SELECT id FROM "user" LIMIT 1').get()

if (!existingUser) {
  const userId = randomUUID()
  const profileId = randomUUID()
  const accountId = randomUUID()
  const now = new Date().toISOString()

  // Hash password (BetterAuth uses bcrypt, but for init script we use sha256 so
  // the user can set a real password via the app; this is a temporary password)
  // Better: use BetterAuth's own password hashing. We'll just set a placeholder
  // that signals "must change password".
  const hashedPassword = 'CHANGE_VIA_APP' // BetterAuth will reject this, user must reset

  console.log('Creating admin user...')

  db.prepare(`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
    VALUES (?, ?, ?, 1, ?, ?)`).run(userId, 'Admin', 'admin@example.com', now, now)

  db.prepare(`INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
    VALUES (?, ?, 'credential', ?, ?, ?, ?)`).run(accountId, userId, userId, hashedPassword, now, now)

  db.prepare(`INSERT INTO profiles (id, user_id, full_name, email, role, is_super_admin, must_change_password, ativo, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'admin', 1, 1, 1, ?, ?)`).run(profileId, userId, 'Admin', 'admin@example.com', now, now)

  console.log('\n✅ Database initialized successfully!')
  console.log('\n📋 Admin credentials:')
  console.log('   Email:    admin@example.com')
  console.log('   Password: (set via /api/auth/reset or update account table)')
  console.log('\n⚠️  Run the app and create a real user via signup,')
  console.log('   or use BetterAuth API to set the password.\n')
} else {
  console.log('✅ Database already initialized — tables ensured.')
}

db.close()
