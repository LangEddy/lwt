DROP TRIGGER IF EXISTS on_auth_user_created_set_default_role ON auth.users;

DROP FUNCTION IF EXISTS public.create_default_user_role();
DROP FUNCTION IF EXISTS public.custom_access_token_hook(jsonb);
DROP FUNCTION IF EXISTS public.has_role(public.app_role);
DROP FUNCTION IF EXISTS public.has_role_at_least(public.app_role);

DROP TABLE IF EXISTS public.user_roles;
DROP TYPE IF EXISTS public.app_role;
