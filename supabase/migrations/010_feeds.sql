-- ============================================================
-- Migration: 010_feeds.sql
-- Description: Creates schemas for the Feeds (Internal Social Network) module
-- including timeline, comments, reactions, views, preferences, shares
-- and automated activity triggers.
-- ============================================================

-- ------------------------------------------------------------
-- TYPES (Idempotent creation via checking pg_type)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feed_post_tipo') THEN
    CREATE TYPE feed_post_tipo AS ENUM ('sistema', 'manual', 'anuncio', 'marco');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feed_post_categoria') THEN
    CREATE TYPE feed_post_categoria AS ENUM ('venda', 'contato', 'chamada', 'tarefa', 'visita_site', 'comentario_geral', 'outros');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feed_post_autor_tipo') THEN
    CREATE TYPE feed_post_autor_tipo AS ENUM ('usuario', 'sistema', 'bot');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feed_post_visibilidade') THEN
    CREATE TYPE feed_post_visibilidade AS ENUM ('publico', 'equipe', 'privado');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'feed_reacao_tipo') THEN
    CREATE TYPE feed_reacao_tipo AS ENUM ('curtir', 'amei', 'parabens', 'importante', 'risada');
  END IF;
END $$;

-- ------------------------------------------------------------
-- 1. TIMELINE PRINCIPAL (feeds)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feeds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo feed_post_tipo NOT NULL DEFAULT 'manual',
  categoria feed_post_categoria NOT NULL DEFAULT 'comentario_geral',
  autor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  autor_tipo feed_post_autor_tipo NOT NULL DEFAULT 'usuario',
  titulo VARCHAR(255) NOT NULL,
  conteudo TEXT NOT NULL,
  entidade_relacionada_tipo VARCHAR(100),
  entidade_relacionada_id UUID,
  acao_realizada VARCHAR(50) CHECK (acao_realizada IN ('criou', 'editou', 'excluiu', 'concluiu', 'comentou')),
  visibilidade feed_post_visibilidade NOT NULL DEFAULT 'publico',
  departamento_id UUID,
  anexos JSONB DEFAULT '[]'::jsonb,
  mencoes JSONB DEFAULT '[]'::jsonb,
  tags JSONB DEFAULT '[]'::jsonb,
  metadados JSONB DEFAULT '{}'::jsonb,
  fixado BOOLEAN DEFAULT false,
  editado BOOLEAN DEFAULT false,
  editado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  excluido_em TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- 2. COMENTÁRIOS (feed_comentarios)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feed_comentarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_id UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  comentario_pai_id UUID REFERENCES feed_comentarios(id) ON DELETE CASCADE,
  autor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  conteudo TEXT NOT NULL,
  anexos JSONB DEFAULT '[]'::jsonb,
  mencoes JSONB DEFAULT '[]'::jsonb,
  editado BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW(),
  excluido_em TIMESTAMPTZ
);

-- ------------------------------------------------------------
-- 3. REAÇÕES (feed_reacoes)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feed_reacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE,
  comentario_id UUID REFERENCES feed_comentarios(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo_reacao feed_reacao_tipo NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(usuario_id, feed_id, comentario_id),
  CONSTRAINT chk_reacao_target CHECK (
    (feed_id IS NOT NULL AND comentario_id IS NULL) OR
    (feed_id IS NULL AND comentario_id IS NOT NULL)
  )
);

-- ------------------------------------------------------------
-- 4. VISUALIZAÇÕES (feed_visualizacoes)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feed_visualizacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_id UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  visualizado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(feed_id, usuario_id)
);

-- ------------------------------------------------------------
-- 5. PREFERÊNCIAS DE NOTIFICAÇÕES (feed_preferencias_usuario)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feed_preferencias_usuario (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  categorias_silenciadas JSONB DEFAULT '[]'::jsonb,
  notificar_mencoes BOOLEAN DEFAULT true,
  notificar_respostas BOOLEAN DEFAULT true,
  notificar_reacoes BOOLEAN DEFAULT false,
  frequencia_resumo_email VARCHAR(50) DEFAULT 'nunca' CHECK (frequencia_resumo_email IN ('nunca', 'diario', 'semanal')),
  UNIQUE(user_id, usuario_id)
);

-- ------------------------------------------------------------
-- 6. COMPARTILHAMENTOS DE POSTS (feed_compartilhamentos)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS feed_compartilhamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feed_original_id UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  comentario_compartilhamento TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- ÍNDICES OTIMIZADOS
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_feeds_user_id ON feeds(user_id) WHERE excluido_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_feeds_criado_em ON feeds(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_feeds_fixado ON feeds(fixado) WHERE fixado = true;
CREATE INDEX IF NOT EXISTS idx_feed_comentarios_feed ON feed_comentarios(feed_id) WHERE excluido_em IS NULL;
CREATE INDEX IF NOT EXISTS idx_feed_reacoes_feed ON feed_reacoes(feed_id);
CREATE INDEX IF NOT EXISTS idx_feed_visualizacoes_feed_user ON feed_visualizacoes(feed_id, usuario_id);

-- ------------------------------------------------------------
-- UPDATED_AT TRIGGERS
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS set_updated_at ON feeds;
DROP TRIGGER IF EXISTS set_updated_at ON feed_comentarios;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON feeds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON feed_comentarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------
-- TRIGGERS DE ATIVIDADES AUTOMÁTICAS (DEALS & CONTACTS)
-- ------------------------------------------------------------

-- A) Trigger para Deals (Vendas)
CREATE OR REPLACE FUNCTION public.log_deal_feed_event()
RETURNS TRIGGER AS $$
DECLARE
  v_user_name TEXT;
  v_contact_name TEXT;
  v_profile_id UUID;
  v_target_user_id UUID;
BEGIN
  -- Escolhe o user_id adequado (o tenant atual)
  v_target_user_id := COALESCE(NEW.user_id, OLD.user_id);
  
  -- Localizar profile_id e nome correspondente ao autor da modificacao
  SELECT id, full_name INTO v_profile_id, v_user_name FROM public.profiles WHERE user_id = v_target_user_id LIMIT 1;
  
  -- Localizar nome do contato relacionado
  SELECT name INTO v_contact_name FROM public.contacts WHERE id = COALESCE(NEW.contact_id, OLD.contact_id) LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.feeds (
      user_id, tipo, categoria, autor_id, autor_tipo, titulo, conteudo, 
      entidade_relacionada_tipo, entidade_relacionada_id, acao_realizada
    ) VALUES (
      v_target_user_id,
      'sistema',
      'venda',
      v_profile_id,
      'sistema',
      'Nova Venda Criada',
      COALESCE(v_user_name, 'Um atendente') || ' criou o negócio **' || NEW.title || '** no valor de **R$ ' || NEW.value || '** para o contato **' || COALESCE(v_contact_name, 'Desconhecido') || '**.',
      'venda',
      NEW.id,
      'criou'
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.feeds (
      user_id, tipo, categoria, autor_id, autor_tipo, titulo, conteudo, 
      entidade_relacionada_tipo, entidade_relacionada_id, acao_realizada
    ) VALUES (
      v_target_user_id,
      'sistema',
      'venda',
      v_profile_id,
      'sistema',
      'Venda Excluída',
      COALESCE(v_user_name, 'Um atendente') || ' removeu o negócio **' || OLD.title || '** do CRM.',
      'venda',
      OLD.id,
      'excluiu'
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_feed_deal_activity ON public.deals;
CREATE TRIGGER trg_feed_deal_activity
  AFTER INSERT OR DELETE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.log_deal_feed_event();

-- B) Trigger para Contacts (Contatos)
CREATE OR REPLACE FUNCTION public.log_contact_feed_event()
RETURNS TRIGGER AS $$
DECLARE
  v_user_name TEXT;
  v_profile_id UUID;
  v_target_user_id UUID;
BEGIN
  v_target_user_id := COALESCE(NEW.user_id, OLD.user_id);
  SELECT id, full_name INTO v_profile_id, v_user_name FROM public.profiles WHERE user_id = v_target_user_id LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.feeds (
      user_id, tipo, categoria, autor_id, autor_tipo, titulo, conteudo, 
      entidade_relacionada_tipo, entidade_relacionada_id, acao_realizada
    ) VALUES (
      v_target_user_id,
      'sistema',
      'contato',
      v_profile_id,
      'sistema',
      'Novo Contato Adicionado',
      COALESCE(v_user_name, 'Um atendente') || ' adicionou **' || COALESCE(NEW.name, NEW.phone) || '** aos contatos do CRM.',
      'contato',
      NEW.id,
      'criou'
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_feed_contact_activity ON public.contacts;
CREATE TRIGGER trg_feed_contact_activity
  AFTER INSERT ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.log_contact_feed_event();

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------
ALTER TABLE feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_reacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_visualizacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_preferencias_usuario ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_compartilhamentos ENABLE ROW LEVEL SECURITY;

-- Políticas de SELECT (Todos do mesmo tenant/user_id visualizam)
CREATE POLICY "Users can select feeds matching tenant" ON feeds FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can select comments matching tenant" ON feed_comentarios FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can select reactions matching tenant" ON feed_reacoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can select views matching tenant" ON feed_visualizacoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can select preferences matching tenant" ON feed_preferencias_usuario FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can select shares matching tenant" ON feed_compartilhamentos FOR SELECT USING (auth.uid() = user_id);

-- Políticas de INSERT
CREATE POLICY "Users can insert feeds matching tenant" ON feeds FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert comments matching tenant" ON feed_comentarios FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert reactions matching tenant" ON feed_reacoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert views matching tenant" ON feed_visualizacoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert preferences matching tenant" ON feed_preferencias_usuario FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can insert shares matching tenant" ON feed_compartilhamentos FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Políticas de UPDATE
CREATE POLICY "Users can update own feeds" ON feeds FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON feed_comentarios FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can update own preferences" ON feed_preferencias_usuario FOR UPDATE USING (auth.uid() = user_id);

-- Políticas de DELETE
CREATE POLICY "Users can delete own feeds" ON feeds FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON feed_comentarios FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON feed_reacoes FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- ADICIONAR AO CANAL DE REALTIME
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'feeds'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE feeds;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'feed_comentarios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE feed_comentarios;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'feed_reacoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE feed_reacoes;
  END IF;
END $$;
