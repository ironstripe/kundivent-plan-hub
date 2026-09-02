REVOKE EXECUTE ON FUNCTION public.is_active_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_active_editor_or_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_delete_event(uuid, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_backup_token(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.new_inbound_email_token() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_profile_privileges() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_active_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_editor_or_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_delete_event(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.new_inbound_email_token() TO authenticated;