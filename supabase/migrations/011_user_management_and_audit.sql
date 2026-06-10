-- ============================================================
-- Migration: 011_user_management_and_audit.sql
-- Description: Establishes complete schema for user management,
-- modular RBAC permissions, and append-only audit logging.
-- ============================================================

-- 1. EXTEND PROFILES TABLE
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;

-- Safe update: Existing profiles do not need to change password immediately.
-- The first registered profile is automatically designated as Super Admin.
UPDATE public.profiles SET must_change_password = false WHERE must_change_password IS NULL;

-- Set the oldest profile as the Super Admin
UPDATE public.profiles
SET is_super_admin = true
WHERE id = (
  SELECT id FROM public.profiles
  ORDER BY created_at ASC, id ASC
  LIMIT 1
);

-- 2. HELPER FUNCTION TO CHECK SUPER ADMIN ROLE (Prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN COALESCE(
    (SELECT is_super_admin FROM public.profiles WHERE user_id = auth.uid() AND ativo = true),
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  module_name TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT false,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, module_name)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_profile ON public.user_permissions(profile_id);

-- Enable RLS on user_permissions
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Super admins can manage all permissions" ON public.user_permissions;

-- RLS Policies for user_permissions
CREATE POLICY "Users can view own permissions" ON public.user_permissions
  FOR SELECT
  USING (
    profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
    OR public.is_super_admin()
  );

CREATE POLICY "Super admins can manage all permissions" ON public.user_permissions
  FOR ALL
  USING (public.is_super_admin());

-- Trigger set_updated_at for user_permissions
DROP TRIGGER IF EXISTS set_updated_at ON public.user_permissions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. AUDIT LOGS TABLE (Append-Only)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);

-- Enable RLS on audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Super admins can select audit logs" ON public.audit_logs;

-- RLS Policies for audit_logs (Strictly read-only for super admins, no user update/delete/insert allowed directly)
CREATE POLICY "Super admins can select audit logs" ON public.audit_logs
  FOR SELECT
  USING (public.is_super_admin());

-- Helper security definer function to log actions from serverless backend safely (bypasses RLS)
CREATE OR REPLACE FUNCTION public.log_action_safely(
  p_user_id UUID,
  p_user_name TEXT,
  p_action TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_description TEXT
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, user_name, action, entity_type, entity_id, description)
  VALUES (p_user_id, p_user_name, p_action, p_entity_type, p_entity_id, p_description);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Enable real-time for audit_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'audit_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE audit_logs;
  END IF;
END $$;

-- 5. OVERRIDE NEW USER SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_first BOOLEAN;
BEGIN
  -- Determine if this is the first user registering in the system
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO v_is_first;

  INSERT INTO public.profiles (user_id, full_name, email, is_super_admin, must_change_password)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    v_is_first,      -- First user is designated Super Admin
    NOT v_is_first   -- First user is spared mandatory password change; subsequent users must change
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

