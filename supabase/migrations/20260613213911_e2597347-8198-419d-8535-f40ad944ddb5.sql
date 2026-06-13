ALTER TABLE public.players ADD COLUMN IF NOT EXISTS pin_hash TEXT;

REVOKE SELECT ON public.players FROM anon, authenticated, PUBLIC;
GRANT SELECT (id, slug, name, avatar_color, is_admin, created_at) ON public.players TO anon, authenticated;
GRANT ALL ON public.players TO service_role;