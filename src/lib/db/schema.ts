import { sqliteTable, text, integer, real, unique, index, foreignKey } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

const uuid = () => sql<string>`(lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))))`
const now = () => sql<string>`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`

// ─── BetterAuth managed tables ────────────────────────────────────────────────
// NOTE: BetterAuth passes Date objects — use integer timestamp mode so drizzle
// converts them to Unix epoch seconds before SQLite binding.
export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
})

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: text('updated_at'),
})

// ─── App tables ───────────────────────────────────────────────────────────────

export const tenants = sqliteTable('tenants', {
  id: text('id').primaryKey(),                    // = super_admin user_id
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  license_key: text('license_key'),
  license_expires_at: text('license_expires_at'),
  plan: text('plan').default('oem'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()),
})

export const profiles = sqliteTable('profiles', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  tenant_id: text('tenant_id').notNull().default(''),  // = super_admin's user_id
  full_name: text('full_name'),
  email: text('email').notNull(),
  avatar_url: text('avatar_url'),
  role: text('role').default('agent'),
  is_super_admin: integer('is_super_admin', { mode: 'boolean' }).default(false),
  must_change_password: integer('must_change_password', { mode: 'boolean' }).default(false),
  ativo: integer('ativo', { mode: 'boolean' }).default(true),
  license_expires_at: text('license_expires_at'),
  license_key: text('license_key'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_profiles_tenant_id').on(t.tenant_id),
  index('idx_profiles_user_id').on(t.user_id),
])

export const contacts = sqliteTable('contacts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  phone: text('phone'),
  name: text('name'),
  email: text('email'),
  company: text('company'),
  avatar_url: text('avatar_url'),
  // Extended CRM fields
  salutation: text('salutation'),
  last_name: text('last_name'),
  street: text('street'),
  city: text('city'),
  state: text('state'),
  zip_code: text('zip_code'),
  neighborhood: text('neighborhood'),
  country: text('country'),
  source: text('source'),
  description: text('description'),
  owner_id: text('owner_id'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_contacts_user_id').on(t.user_id),
  index('idx_contacts_phone').on(t.phone),
])

export const tags = sqliteTable('tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  name: text('name').notNull(),
  color: text('color').default('#3b82f6'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
})

export const contact_tags = sqliteTable('contact_tags', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  contact_id: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  tag_id: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => [
  unique('uq_contact_tag').on(t.contact_id, t.tag_id),
])

export const custom_fields = sqliteTable('custom_fields', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  field_name: text('field_name').notNull(),
  field_type: text('field_type').default('text'),
  field_options: text('field_options', { mode: 'json' }),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
})

export const contact_custom_values = sqliteTable('contact_custom_values', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  contact_id: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  custom_field_id: text('custom_field_id').notNull().references(() => custom_fields.id, { onDelete: 'cascade' }),
  value: text('value'),
}, (t) => [
  unique('uq_contact_custom_value').on(t.contact_id, t.custom_field_id),
])

export const contact_notes = sqliteTable('contact_notes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  contact_id: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull(),
  note_text: text('note_text').notNull(),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
})

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  contact_id: text('contact_id').notNull().references(() => contacts.id, { onDelete: 'cascade' }),
  status: text('status').default('open'),
  assigned_agent_id: text('assigned_agent_id'),
  last_message_text: text('last_message_text'),
  last_message_at: text('last_message_at'),
  unread_count: integer('unread_count').default(0),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_conversations_user_id').on(t.user_id),
  index('idx_conversations_contact_id').on(t.contact_id),
])

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversation_id: text('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  sender_type: text('sender_type').notNull(),
  sender_id: text('sender_id'),
  content_type: text('content_type').notNull().default('text'),
  content_text: text('content_text'),
  media_url: text('media_url'),
  template_name: text('template_name'),
  message_id: text('message_id'),
  status: text('status').default('sent'),
  reply_to_message_id: text('reply_to_message_id'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_messages_conversation').on(t.conversation_id),
  index('idx_messages_message_id').on(t.message_id),
])

export const message_reactions = sqliteTable('message_reactions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  message_id: text('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  conversation_id: text('conversation_id').notNull(),
  actor_type: text('actor_type').notNull(),
  actor_id: text('actor_id'),
  emoji: text('emoji').notNull(),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  unique('uq_message_reaction').on(t.message_id, t.actor_type, t.actor_id),
])

export const whatsapp_config = sqliteTable('whatsapp_config', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull().unique(),
  phone_number_id: text('phone_number_id'),
  waba_id: text('waba_id'),
  access_token: text('access_token'),
  verify_token: text('verify_token'),
  status: text('status').default('disconnected'),
  connected_at: text('connected_at'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()),
})

export const message_templates = sqliteTable('message_templates', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  name: text('name').notNull(),
  category: text('category'),
  language: text('language').default('en_US'),
  header_type: text('header_type'),
  header_content: text('header_content'),
  body_text: text('body_text').notNull(),
  footer_text: text('footer_text'),
  buttons: text('buttons', { mode: 'json' }),
  status: text('status').default('Draft'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()),
})

export const pipelines = sqliteTable('pipelines', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  name: text('name').notNull(),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
})

export const pipeline_stages = sqliteTable('pipeline_stages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  pipeline_id: text('pipeline_id').notNull().references(() => pipelines.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  position: integer('position').notNull().default(0),
  color: text('color').default('#3b82f6'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_pipeline_stages_pipeline').on(t.pipeline_id),
])

export const deals = sqliteTable('deals', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  pipeline_id: text('pipeline_id').notNull().references(() => pipelines.id, { onDelete: 'cascade' }),
  stage_id: text('stage_id').notNull(),
  contact_id: text('contact_id'),
  conversation_id: text('conversation_id'),
  assigned_to: text('assigned_to'),
  title: text('title').notNull(),
  value: real('value').default(0),
  currency: text('currency').default('USD'),
  notes: text('notes'),
  expected_close_date: text('expected_close_date'),
  status: text('status').default('open'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_deals_pipeline').on(t.pipeline_id),
  index('idx_deals_stage').on(t.stage_id),
])

export const broadcasts = sqliteTable('broadcasts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  name: text('name').notNull(),
  template_name: text('template_name').notNull(),
  template_language: text('template_language').default('en_US'),
  template_variables: text('template_variables', { mode: 'json' }),
  audience_filter: text('audience_filter', { mode: 'json' }),
  scheduled_at: text('scheduled_at'),
  status: text('status').default('draft'),
  total_recipients: integer('total_recipients').default(0),
  sent_count: integer('sent_count').default(0),
  delivered_count: integer('delivered_count').default(0),
  read_count: integer('read_count').default(0),
  replied_count: integer('replied_count').default(0),
  failed_count: integer('failed_count').default(0),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()),
})

export const broadcast_recipients = sqliteTable('broadcast_recipients', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  broadcast_id: text('broadcast_id').notNull().references(() => broadcasts.id, { onDelete: 'cascade' }),
  contact_id: text('contact_id'),
  status: text('status').default('pending'),
  whatsapp_message_id: text('whatsapp_message_id').unique(),
  sent_at: text('sent_at'),
  delivered_at: text('delivered_at'),
  read_at: text('read_at'),
  replied_at: text('replied_at'),
  error_message: text('error_message'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_broadcast_recipients_broadcast').on(t.broadcast_id),
  index('idx_broadcast_recipients_wamid').on(t.whatsapp_message_id),
])

export const automations = sqliteTable('automations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  trigger_type: text('trigger_type').notNull(),
  trigger_config: text('trigger_config', { mode: 'json' }),
  is_active: integer('is_active', { mode: 'boolean' }).default(false),
  execution_count: integer('execution_count').default(0),
  last_executed_at: text('last_executed_at'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_automations_user_id').on(t.user_id),
])

export const automation_steps = sqliteTable('automation_steps', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  automation_id: text('automation_id').notNull().references(() => automations.id, { onDelete: 'cascade' }),
  parent_step_id: text('parent_step_id'),
  branch: text('branch'),
  step_type: text('step_type').notNull(),
  step_config: text('step_config', { mode: 'json' }),
  position: integer('position').notNull().default(0),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
})

export const automation_logs = sqliteTable('automation_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  automation_id: text('automation_id').notNull().references(() => automations.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull(),
  contact_id: text('contact_id'),
  trigger_event: text('trigger_event').notNull(),
  steps_executed: text('steps_executed', { mode: 'json' }),
  status: text('status').notNull().default('success'),
  error_message: text('error_message'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
})

export const automation_pending_executions = sqliteTable('automation_pending_executions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  automation_id: text('automation_id').notNull().references(() => automations.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull(),
  contact_id: text('contact_id'),
  log_id: text('log_id').references(() => automation_logs.id, { onDelete: 'cascade' }),
  parent_step_id: text('parent_step_id'),
  branch: text('branch'),
  next_step_position: integer('next_step_position'),
  context: text('context', { mode: 'json' }),
  status: text('status').default('pending'),
  run_at: text('run_at').notNull(),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_automation_pending_due').on(t.run_at, t.status),
])

export const feeds = sqliteTable('feeds', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  tipo: text('tipo').notNull().default('manual'),
  categoria: text('categoria').notNull().default('outros'),
  autor_id: text('autor_id'),
  autor_tipo: text('autor_tipo').notNull().default('usuario'),
  titulo: text('titulo').notNull(),
  conteudo: text('conteudo').notNull(),
  entidade_relacionada_tipo: text('entidade_relacionada_tipo'),
  entidade_relacionada_id: text('entidade_relacionada_id'),
  acao_realizada: text('acao_realizada'),
  visibilidade: text('visibilidade').default('publico'),
  departamento_id: text('departamento_id'),
  anexos: text('anexos', { mode: 'json' }).$defaultFn(() => []),
  mencoes: text('mencoes', { mode: 'json' }).$defaultFn(() => []),
  tags: text('tags', { mode: 'json' }).$defaultFn(() => []),
  metadados: text('metadados', { mode: 'json' }),
  fixado: integer('fixado', { mode: 'boolean' }).default(false),
  editado: integer('editado', { mode: 'boolean' }).default(false),
  editado_em: text('editado_em'),
  criado_em: text('criado_em').$defaultFn(() => new Date().toISOString()),
  atualizado_em: text('atualizado_em').$defaultFn(() => new Date().toISOString()),
  excluido_em: text('excluido_em'),
}, (t) => [
  index('idx_feeds_user_id').on(t.user_id),
  index('idx_feeds_criado_em').on(t.criado_em),
])

export const feed_comentarios = sqliteTable('feed_comentarios', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  feed_id: text('feed_id').notNull().references(() => feeds.id, { onDelete: 'cascade' }),
  comentario_pai_id: text('comentario_pai_id'),
  autor_id: text('autor_id'),
  conteudo: text('conteudo').notNull(),
  anexos: text('anexos', { mode: 'json' }).$defaultFn(() => []),
  mencoes: text('mencoes', { mode: 'json' }).$defaultFn(() => []),
  editado: integer('editado', { mode: 'boolean' }).default(false),
  criado_em: text('criado_em').$defaultFn(() => new Date().toISOString()),
  atualizado_em: text('atualizado_em').$defaultFn(() => new Date().toISOString()),
  excluido_em: text('excluido_em'),
}, (t) => [
  index('idx_feed_comentarios_feed').on(t.feed_id),
])

export const feed_reacoes = sqliteTable('feed_reacoes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  feed_id: text('feed_id'),
  comentario_id: text('comentario_id'),
  usuario_id: text('usuario_id').notNull(),
  tipo_reacao: text('tipo_reacao').notNull(),
  criado_em: text('criado_em').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  unique('uq_feed_reacao').on(t.usuario_id, t.feed_id, t.comentario_id),
])

export const feed_visualizacoes = sqliteTable('feed_visualizacoes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  feed_id: text('feed_id').notNull().references(() => feeds.id, { onDelete: 'cascade' }),
  usuario_id: text('usuario_id').notNull(),
  visualizado_em: text('visualizado_em').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  unique('uq_feed_view').on(t.feed_id, t.usuario_id),
])

export const feed_preferencias_usuario = sqliteTable('feed_preferencias_usuario', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  usuario_id: text('usuario_id').notNull(),
  categorias_silenciadas: text('categorias_silenciadas', { mode: 'json' }).$defaultFn(() => []),
  notificar_mencoes: integer('notificar_mencoes', { mode: 'boolean' }).default(true),
  notificar_respostas: integer('notificar_respostas', { mode: 'boolean' }).default(true),
  notificar_reacoes: integer('notificar_reacoes', { mode: 'boolean' }).default(false),
  frequencia_resumo_email: text('frequencia_resumo_email').default('nunca'),
}, (t) => [
  unique('uq_feed_pref').on(t.user_id, t.usuario_id),
])

export const feed_compartilhamentos = sqliteTable('feed_compartilhamentos', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  feed_original_id: text('feed_original_id').notNull().references(() => feeds.id, { onDelete: 'cascade' }),
  usuario_id: text('usuario_id').notNull(),
  comentario_compartilhamento: text('comentario_compartilhamento'),
  criado_em: text('criado_em').$defaultFn(() => new Date().toISOString()),
})

export const user_permissions = sqliteTable('user_permissions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  profile_id: text('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  module_name: text('module_name').notNull(),
  can_view: integer('can_view', { mode: 'boolean' }).default(true),
  can_create: integer('can_create', { mode: 'boolean' }).default(false),
  can_edit: integer('can_edit', { mode: 'boolean' }).default(false),
  can_delete: integer('can_delete', { mode: 'boolean' }).default(false),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  unique('uq_user_permission').on(t.profile_id, t.module_name),
])

export const audit_logs = sqliteTable('audit_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id'),
  user_name: text('user_name'),
  action: text('action').notNull(),
  entity_type: text('entity_type'),
  entity_id: text('entity_id'),
  description: text('description'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_audit_logs_created_at').on(t.created_at),
  index('idx_audit_logs_user').on(t.user_id),
])

// ─── CRM Modules ─────────────────────────────────────────────────────────────

export const leads = sqliteTable('leads', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  company: text('company'),
  source: text('source'),
  status: text('status').default('novo'),
  owner_id: text('owner_id'),
  description: text('description'),
  converted_to_contact_id: text('converted_to_contact_id'),
  converted_at: text('converted_at'),
  created_by: text('created_by'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_leads_user_id').on(t.user_id),
  index('idx_leads_status').on(t.status),
])

export const crm_tasks = sqliteTable('crm_tasks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').default('pendente'),
  priority: text('priority').default('media'),
  due_date: text('due_date'),
  completed_at: text('completed_at'),
  assigned_to: text('assigned_to'),
  contact_id: text('contact_id'),
  lead_id: text('lead_id'),
  deal_id: text('deal_id'),
  created_by: text('created_by'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_crm_tasks_user_id').on(t.user_id),
  index('idx_crm_tasks_status').on(t.status),
  index('idx_crm_tasks_due_date').on(t.due_date),
])

export const crm_events = sqliteTable('crm_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  start_datetime: text('start_datetime').notNull(),
  end_datetime: text('end_datetime'),
  location: text('location'),
  status: text('status').default('agendada'),
  participants: text('participants', { mode: 'json' }).$defaultFn(() => []),
  contact_id: text('contact_id'),
  lead_id: text('lead_id'),
  deal_id: text('deal_id'),
  created_by: text('created_by'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_crm_events_user_id').on(t.user_id),
  index('idx_crm_events_start').on(t.start_datetime),
])

export const crm_calls = sqliteTable('crm_calls', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  direction: text('direction').default('saida'),
  status: text('status').default('conectado'),
  duration_minutes: real('duration_minutes').default(0),
  call_datetime: text('call_datetime').notNull(),
  notes: text('notes'),
  contact_id: text('contact_id'),
  lead_id: text('lead_id'),
  deal_id: text('deal_id'),
  created_by: text('created_by'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_crm_calls_user_id').on(t.user_id),
  index('idx_crm_calls_datetime').on(t.call_datetime),
])

export const crm_folders = sqliteTable('crm_folders', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  name: text('name').notNull(),
  parent_folder_id: text('parent_folder_id'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_crm_folders_user_id').on(t.user_id),
])

export const crm_documents = sqliteTable('crm_documents', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  file_url: text('file_url'),
  file_type: text('file_type'),
  file_size: integer('file_size').default(0),
  folder_id: text('folder_id'),
  contact_id: text('contact_id'),
  deal_id: text('deal_id'),
  lead_id: text('lead_id'),
  created_by: text('created_by'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_crm_documents_user_id').on(t.user_id),
  index('idx_crm_documents_folder').on(t.folder_id),
])

export const tickets = sqliteTable('tickets', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  subject: text('subject').notNull(),
  description: text('description'),
  status: text('status').default('aberto'),
  priority: text('priority').default('media'),
  contact_id: text('contact_id'),
  assigned_to: text('assigned_to'),
  resolved_at: text('resolved_at'),
  closed_at: text('closed_at'),
  created_by: text('created_by'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_tickets_user_id').on(t.user_id),
  index('idx_tickets_status').on(t.status),
  index('idx_tickets_contact').on(t.contact_id),
])

export const ticket_comments = sqliteTable('ticket_comments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ticket_id: text('ticket_id').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull(),
  content: text('content').notNull(),
  is_internal: integer('is_internal', { mode: 'boolean' }).default(false),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_ticket_comments_ticket').on(t.ticket_id),
])

export const website_visits = sqliteTable('website_visits', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  user_id: text('user_id').notNull(),
  contact_id: text('contact_id'),
  visitor_name: text('visitor_name'),
  visitor_email: text('visitor_email'),
  page_url: text('page_url'),
  page_title: text('page_title'),
  referrer: text('referrer'),
  source: text('source'),
  browser: text('browser'),
  os: text('os'),
  first_visit_at: text('first_visit_at').$defaultFn(() => new Date().toISOString()),
  last_visit_at: text('last_visit_at').$defaultFn(() => new Date().toISOString()),
  visit_count: integer('visit_count').default(1),
  total_time_seconds: integer('total_time_seconds').default(0),
  visitor_score: integer('visitor_score').default(0),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_website_visits_user_id').on(t.user_id),
  index('idx_website_visits_contact').on(t.contact_id),
])

export const sales = sqliteTable('sales', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull(),
  company_name: text('company_name').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').default('BRL'),
  payment_method: text('payment_method').default('pix'),
  efi_txid: text('efi_txid').unique(),
  efi_loc_id: text('efi_loc_id'),
  pix_copia_cola: text('pix_copia_cola'),
  qr_code_image: text('qr_code_image'),  // base64
  payment_status: text('payment_status').default('pending'), // pending|paid|expired|refunded
  license_key: text('license_key'),
  license_key_id: text('license_key_id'),
  is_renewal: integer('is_renewal', { mode: 'boolean' }).default(false),
  renewal_tenant_id: text('renewal_tenant_id'),
  paid_at: text('paid_at'),
  email_sent_at: text('email_sent_at'),
  expires_pix_at: text('expires_pix_at'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
  updated_at: text('updated_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_sales_email').on(t.email),
  index('idx_sales_efi_txid').on(t.efi_txid),
  index('idx_sales_status').on(t.payment_status),
])

export const license_keys = sqliteTable('license_keys', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text('key').notNull().unique(),
  label: text('label'),
  role: text('role').default('agent'),
  max_uses: integer('max_uses').default(1),
  use_count: integer('use_count').default(0),
  is_active: integer('is_active', { mode: 'boolean' }).default(true),
  created_by_user_id: text('created_by_user_id').notNull(),
  created_by_name: text('created_by_name'),
  expires_at: text('expires_at'),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_license_keys_key').on(t.key),
  index('idx_license_keys_created_by').on(t.created_by_user_id),
])

export const invites = sqliteTable('invites', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  token: text('token').notNull().unique(),
  tenant_id: text('tenant_id').notNull(),          // which company this invite belongs to
  email: text('email'),
  role: text('role').default('agent'),
  created_by_user_id: text('created_by_user_id').notNull(),
  created_by_name: text('created_by_name'),
  used_by_user_id: text('used_by_user_id'),
  used_at: text('used_at'),
  expires_at: text('expires_at').notNull(),
  created_at: text('created_at').$defaultFn(() => new Date().toISOString()),
}, (t) => [
  index('idx_invites_token').on(t.token),
  index('idx_invites_tenant').on(t.tenant_id),
  index('idx_invites_created_by').on(t.created_by_user_id),
])
