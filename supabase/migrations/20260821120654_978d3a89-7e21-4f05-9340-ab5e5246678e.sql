REVOKE ALL ON FUNCTION public.is_active_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;