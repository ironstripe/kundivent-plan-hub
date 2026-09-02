REVOKE EXECUTE ON FUNCTION public.is_active_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_active_editor_or_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_delete_event(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_backup_token(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.new_inbound_email_token() FROM anon;