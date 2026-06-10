CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`user_name` text,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`description` text,
	`created_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_audit_logs_created_at` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_logs_user` ON `audit_logs` (`user_id`);--> statement-breakpoint
CREATE TABLE `automation_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`automation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`contact_id` text,
	`trigger_event` text NOT NULL,
	`steps_executed` text,
	`status` text DEFAULT 'success' NOT NULL,
	`error_message` text,
	`created_at` text,
	FOREIGN KEY (`automation_id`) REFERENCES `automations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `automation_pending_executions` (
	`id` text PRIMARY KEY NOT NULL,
	`automation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`contact_id` text,
	`log_id` text,
	`parent_step_id` text,
	`branch` text,
	`next_step_position` integer,
	`context` text,
	`status` text DEFAULT 'pending',
	`run_at` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`automation_id`) REFERENCES `automations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`log_id`) REFERENCES `automation_logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_automation_pending_due` ON `automation_pending_executions` (`run_at`,`status`);--> statement-breakpoint
CREATE TABLE `automation_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`automation_id` text NOT NULL,
	`parent_step_id` text,
	`branch` text,
	`step_type` text NOT NULL,
	`step_config` text,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` text,
	FOREIGN KEY (`automation_id`) REFERENCES `automations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `automations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`trigger_type` text NOT NULL,
	`trigger_config` text,
	`is_active` integer DEFAULT false,
	`execution_count` integer DEFAULT 0,
	`last_executed_at` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_automations_user_id` ON `automations` (`user_id`);--> statement-breakpoint
CREATE TABLE `broadcast_recipients` (
	`id` text PRIMARY KEY NOT NULL,
	`broadcast_id` text NOT NULL,
	`contact_id` text,
	`status` text DEFAULT 'pending',
	`whatsapp_message_id` text,
	`sent_at` text,
	`delivered_at` text,
	`read_at` text,
	`replied_at` text,
	`error_message` text,
	`created_at` text,
	FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `broadcast_recipients_whatsapp_message_id_unique` ON `broadcast_recipients` (`whatsapp_message_id`);--> statement-breakpoint
CREATE INDEX `idx_broadcast_recipients_broadcast` ON `broadcast_recipients` (`broadcast_id`);--> statement-breakpoint
CREATE INDEX `idx_broadcast_recipients_wamid` ON `broadcast_recipients` (`whatsapp_message_id`);--> statement-breakpoint
CREATE TABLE `broadcasts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`template_name` text NOT NULL,
	`template_language` text DEFAULT 'en_US',
	`template_variables` text,
	`audience_filter` text,
	`scheduled_at` text,
	`status` text DEFAULT 'draft',
	`total_recipients` integer DEFAULT 0,
	`sent_count` integer DEFAULT 0,
	`delivered_count` integer DEFAULT 0,
	`read_count` integer DEFAULT 0,
	`replied_count` integer DEFAULT 0,
	`failed_count` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `contact_custom_values` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`custom_field_id` text NOT NULL,
	`value` text,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`custom_field_id`) REFERENCES `custom_fields`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_contact_custom_value` ON `contact_custom_values` (`contact_id`,`custom_field_id`);--> statement-breakpoint
CREATE TABLE `contact_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`user_id` text NOT NULL,
	`note_text` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `contact_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`contact_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_contact_tag` ON `contact_tags` (`contact_id`,`tag_id`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`phone` text,
	`name` text,
	`email` text,
	`company` text,
	`avatar_url` text,
	`salutation` text,
	`last_name` text,
	`street` text,
	`city` text,
	`state` text,
	`zip_code` text,
	`neighborhood` text,
	`country` text,
	`source` text,
	`description` text,
	`owner_id` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_contacts_user_id` ON `contacts` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_contacts_phone` ON `contacts` (`phone`);--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`contact_id` text NOT NULL,
	`status` text DEFAULT 'open',
	`assigned_agent_id` text,
	`last_message_text` text,
	`last_message_at` text,
	`unread_count` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_conversations_user_id` ON `conversations` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_conversations_contact_id` ON `conversations` (`contact_id`);--> statement-breakpoint
CREATE TABLE `crm_calls` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`direction` text DEFAULT 'saida',
	`status` text DEFAULT 'conectado',
	`duration_minutes` real DEFAULT 0,
	`call_datetime` text NOT NULL,
	`notes` text,
	`contact_id` text,
	`lead_id` text,
	`deal_id` text,
	`created_by` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_crm_calls_user_id` ON `crm_calls` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_calls_datetime` ON `crm_calls` (`call_datetime`);--> statement-breakpoint
CREATE TABLE `crm_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`file_url` text,
	`file_type` text,
	`file_size` integer DEFAULT 0,
	`folder_id` text,
	`contact_id` text,
	`deal_id` text,
	`lead_id` text,
	`created_by` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_crm_documents_user_id` ON `crm_documents` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_documents_folder` ON `crm_documents` (`folder_id`);--> statement-breakpoint
CREATE TABLE `crm_events` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`start_datetime` text NOT NULL,
	`end_datetime` text,
	`location` text,
	`status` text DEFAULT 'agendada',
	`participants` text,
	`contact_id` text,
	`lead_id` text,
	`deal_id` text,
	`created_by` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_crm_events_user_id` ON `crm_events` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_events_start` ON `crm_events` (`start_datetime`);--> statement-breakpoint
CREATE TABLE `crm_folders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`parent_folder_id` text,
	`created_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_crm_folders_user_id` ON `crm_folders` (`user_id`);--> statement-breakpoint
CREATE TABLE `crm_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'pendente',
	`priority` text DEFAULT 'media',
	`due_date` text,
	`completed_at` text,
	`assigned_to` text,
	`contact_id` text,
	`lead_id` text,
	`deal_id` text,
	`created_by` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_crm_tasks_user_id` ON `crm_tasks` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_crm_tasks_status` ON `crm_tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_crm_tasks_due_date` ON `crm_tasks` (`due_date`);--> statement-breakpoint
CREATE TABLE `custom_fields` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`field_name` text NOT NULL,
	`field_type` text DEFAULT 'text',
	`field_options` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `deals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`pipeline_id` text NOT NULL,
	`stage_id` text NOT NULL,
	`contact_id` text,
	`conversation_id` text,
	`assigned_to` text,
	`title` text NOT NULL,
	`value` real DEFAULT 0,
	`currency` text DEFAULT 'USD',
	`notes` text,
	`expected_close_date` text,
	`status` text DEFAULT 'open',
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`pipeline_id`) REFERENCES `pipelines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_deals_pipeline` ON `deals` (`pipeline_id`);--> statement-breakpoint
CREATE INDEX `idx_deals_stage` ON `deals` (`stage_id`);--> statement-breakpoint
CREATE TABLE `feed_comentarios` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`feed_id` text NOT NULL,
	`comentario_pai_id` text,
	`autor_id` text,
	`conteudo` text NOT NULL,
	`anexos` text,
	`mencoes` text,
	`editado` integer DEFAULT false,
	`criado_em` text,
	`atualizado_em` text,
	`excluido_em` text,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_feed_comentarios_feed` ON `feed_comentarios` (`feed_id`);--> statement-breakpoint
CREATE TABLE `feed_compartilhamentos` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`feed_original_id` text NOT NULL,
	`usuario_id` text NOT NULL,
	`comentario_compartilhamento` text,
	`criado_em` text,
	FOREIGN KEY (`feed_original_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `feed_preferencias_usuario` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`usuario_id` text NOT NULL,
	`categorias_silenciadas` text,
	`notificar_mencoes` integer DEFAULT true,
	`notificar_respostas` integer DEFAULT true,
	`notificar_reacoes` integer DEFAULT false,
	`frequencia_resumo_email` text DEFAULT 'nunca'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_feed_pref` ON `feed_preferencias_usuario` (`user_id`,`usuario_id`);--> statement-breakpoint
CREATE TABLE `feed_reacoes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`feed_id` text,
	`comentario_id` text,
	`usuario_id` text NOT NULL,
	`tipo_reacao` text NOT NULL,
	`criado_em` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_feed_reacao` ON `feed_reacoes` (`usuario_id`,`feed_id`,`comentario_id`);--> statement-breakpoint
CREATE TABLE `feed_visualizacoes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`feed_id` text NOT NULL,
	`usuario_id` text NOT NULL,
	`visualizado_em` text,
	FOREIGN KEY (`feed_id`) REFERENCES `feeds`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_feed_view` ON `feed_visualizacoes` (`feed_id`,`usuario_id`);--> statement-breakpoint
CREATE TABLE `feeds` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tipo` text DEFAULT 'manual' NOT NULL,
	`categoria` text DEFAULT 'outros' NOT NULL,
	`autor_id` text,
	`autor_tipo` text DEFAULT 'usuario' NOT NULL,
	`titulo` text NOT NULL,
	`conteudo` text NOT NULL,
	`entidade_relacionada_tipo` text,
	`entidade_relacionada_id` text,
	`acao_realizada` text,
	`visibilidade` text DEFAULT 'publico',
	`departamento_id` text,
	`anexos` text,
	`mencoes` text,
	`tags` text,
	`metadados` text,
	`fixado` integer DEFAULT false,
	`editado` integer DEFAULT false,
	`editado_em` text,
	`criado_em` text,
	`atualizado_em` text,
	`excluido_em` text
);
--> statement-breakpoint
CREATE INDEX `idx_feeds_user_id` ON `feeds` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_feeds_criado_em` ON `feeds` (`criado_em`);--> statement-breakpoint
CREATE TABLE `invites` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`tenant_id` text NOT NULL,
	`email` text,
	`role` text DEFAULT 'agent',
	`created_by_user_id` text NOT NULL,
	`created_by_name` text,
	`used_by_user_id` text,
	`used_at` text,
	`expires_at` text NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_token_unique` ON `invites` (`token`);--> statement-breakpoint
CREATE INDEX `idx_invites_token` ON `invites` (`token`);--> statement-breakpoint
CREATE INDEX `idx_invites_tenant` ON `invites` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_invites_created_by` ON `invites` (`created_by_user_id`);--> statement-breakpoint
CREATE TABLE `leads` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`company` text,
	`source` text,
	`status` text DEFAULT 'novo',
	`owner_id` text,
	`description` text,
	`converted_to_contact_id` text,
	`converted_at` text,
	`created_by` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_leads_user_id` ON `leads` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_leads_status` ON `leads` (`status`);--> statement-breakpoint
CREATE TABLE `license_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`label` text,
	`role` text DEFAULT 'agent',
	`max_uses` integer DEFAULT 1,
	`use_count` integer DEFAULT 0,
	`is_active` integer DEFAULT true,
	`created_by_user_id` text NOT NULL,
	`created_by_name` text,
	`expires_at` text,
	`created_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `license_keys_key_unique` ON `license_keys` (`key`);--> statement-breakpoint
CREATE INDEX `idx_license_keys_key` ON `license_keys` (`key`);--> statement-breakpoint
CREATE INDEX `idx_license_keys_created_by` ON `license_keys` (`created_by_user_id`);--> statement-breakpoint
CREATE TABLE `message_reactions` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`conversation_id` text NOT NULL,
	`actor_type` text NOT NULL,
	`actor_id` text,
	`emoji` text NOT NULL,
	`created_at` text,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_message_reaction` ON `message_reactions` (`message_id`,`actor_type`,`actor_id`);--> statement-breakpoint
CREATE TABLE `message_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`language` text DEFAULT 'en_US',
	`header_type` text,
	`header_content` text,
	`body_text` text NOT NULL,
	`footer_text` text,
	`buttons` text,
	`status` text DEFAULT 'Draft',
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_type` text NOT NULL,
	`sender_id` text,
	`content_type` text DEFAULT 'text' NOT NULL,
	`content_text` text,
	`media_url` text,
	`template_name` text,
	`message_id` text,
	`status` text DEFAULT 'sent',
	`reply_to_message_id` text,
	`created_at` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_messages_conversation` ON `messages` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_message_id` ON `messages` (`message_id`);--> statement-breakpoint
CREATE TABLE `pipeline_stages` (
	`id` text PRIMARY KEY NOT NULL,
	`pipeline_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`color` text DEFAULT '#3b82f6',
	`created_at` text,
	FOREIGN KEY (`pipeline_id`) REFERENCES `pipelines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_pipeline_stages_pipeline` ON `pipeline_stages` (`pipeline_id`);--> statement-breakpoint
CREATE TABLE `pipelines` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`tenant_id` text DEFAULT '' NOT NULL,
	`full_name` text,
	`email` text NOT NULL,
	`avatar_url` text,
	`role` text DEFAULT 'agent',
	`is_super_admin` integer DEFAULT false,
	`must_change_password` integer DEFAULT false,
	`ativo` integer DEFAULT true,
	`license_expires_at` text,
	`license_key` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_profiles_tenant_id` ON `profiles` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `idx_profiles_user_id` ON `profiles` (`user_id`);--> statement-breakpoint
CREATE TABLE `sales` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`company_name` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text DEFAULT 'BRL',
	`payment_method` text DEFAULT 'pix',
	`efi_txid` text,
	`efi_loc_id` text,
	`pix_copia_cola` text,
	`qr_code_image` text,
	`payment_status` text DEFAULT 'pending',
	`license_key` text,
	`license_key_id` text,
	`is_renewal` integer DEFAULT false,
	`renewal_tenant_id` text,
	`paid_at` text,
	`email_sent_at` text,
	`expires_pix_at` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_efi_txid_unique` ON `sales` (`efi_txid`);--> statement-breakpoint
CREATE INDEX `idx_sales_email` ON `sales` (`email`);--> statement-breakpoint
CREATE INDEX `idx_sales_efi_txid` ON `sales` (`efi_txid`);--> statement-breakpoint
CREATE INDEX `idx_sales_status` ON `sales` (`payment_status`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#3b82f6',
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`license_key` text,
	`license_expires_at` text,
	`plan` text DEFAULT 'oem',
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_email_unique` ON `tenants` (`email`);--> statement-breakpoint
CREATE TABLE `ticket_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`is_internal` integer DEFAULT false,
	`created_at` text,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_ticket_comments_ticket` ON `ticket_comments` (`ticket_id`);--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subject` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'aberto',
	`priority` text DEFAULT 'media',
	`contact_id` text,
	`assigned_to` text,
	`resolved_at` text,
	`closed_at` text,
	`created_by` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_tickets_user_id` ON `tickets` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_tickets_status` ON `tickets` (`status`);--> statement-breakpoint
CREATE INDEX `idx_tickets_contact` ON `tickets` (`contact_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `user_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`module_name` text NOT NULL,
	`can_view` integer DEFAULT true,
	`can_create` integer DEFAULT false,
	`can_edit` integer DEFAULT false,
	`can_delete` integer DEFAULT false,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_user_permission` ON `user_permissions` (`profile_id`,`module_name`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `website_visits` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`contact_id` text,
	`visitor_name` text,
	`visitor_email` text,
	`page_url` text,
	`page_title` text,
	`referrer` text,
	`source` text,
	`browser` text,
	`os` text,
	`first_visit_at` text,
	`last_visit_at` text,
	`visit_count` integer DEFAULT 1,
	`total_time_seconds` integer DEFAULT 0,
	`visitor_score` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_website_visits_user_id` ON `website_visits` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_website_visits_contact` ON `website_visits` (`contact_id`);--> statement-breakpoint
CREATE TABLE `whatsapp_config` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`phone_number_id` text,
	`waba_id` text,
	`access_token` text,
	`verify_token` text,
	`status` text DEFAULT 'disconnected',
	`connected_at` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `whatsapp_config_user_id_unique` ON `whatsapp_config` (`user_id`);