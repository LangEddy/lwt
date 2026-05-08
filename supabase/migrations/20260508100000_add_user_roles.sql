CREATE TYPE app_role AS ENUM ('user', 'moderator', 'admin');

CREATE TABLE user_roles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_roles_role ON user_roles(role);

CREATE TRIGGER update_user_roles_updated_at BEFORE UPDATE ON user_roles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Backfill existing users with the default role.
INSERT INTO user_roles (user_id, role)
SELECT id, 'user'::app_role
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Keep role rows in sync for future signups.
CREATE OR REPLACE FUNCTION create_default_user_role()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user'::public.app_role)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE t.tgname = 'on_auth_user_created_set_default_role'
          AND n.nspname = 'auth'
          AND c.relname = 'users'
    ) THEN
        DROP TRIGGER on_auth_user_created_set_default_role ON auth.users;
    END IF;
END;
$$;

CREATE TRIGGER on_auth_user_created_set_default_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_default_user_role();

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_roles: read own"
    ON user_roles FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "user_roles: auth admin all"
    ON user_roles FOR ALL TO supabase_auth_admin
    USING (true)
    WITH CHECK (true);

-- Helper functions for RLS and server-side authorization checks.
CREATE OR REPLACE FUNCTION public.has_role(required_role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.role = required_role
    );
$$;

CREATE OR REPLACE FUNCTION public.has_role_at_least(required_role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        WHERE ur.user_id = (SELECT auth.uid())
          AND ur.role >= required_role
    );
$$;

GRANT EXECUTE ON FUNCTION public.has_role(public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role_at_least(public.app_role) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.has_role_at_least(public.app_role) FROM anon, public;

-- Custom Access Token hook injects app_role into JWT claims.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    claims jsonb;
    user_role public.app_role;
BEGIN
    SELECT role
      INTO user_role
      FROM public.user_roles
     WHERE user_id = (event->>'user_id')::uuid;

    claims := COALESCE(event->'claims', '{}'::jsonb);

    claims := jsonb_set(
        claims,
        '{user_role}',
        to_jsonb(COALESCE(user_role, 'user'::public.app_role)::text),
        true
    );

    -- Keep app_role as a compatibility alias for existing backend/frontend code.
    claims := jsonb_set(
        claims,
        '{app_role}',
        claims->'user_role',
        true
    );

    event := jsonb_set(event, '{claims}', claims, true);
    RETURN event;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;

REVOKE ALL ON TABLE public.user_roles FROM anon, public;
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO supabase_auth_admin;
