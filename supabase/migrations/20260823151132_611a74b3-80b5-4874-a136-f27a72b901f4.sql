-- 1) Restrict profile reads: own row for everyone, all rows for active admins
DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;

CREATE POLICY "Users can read their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Admins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.is_active_admin(auth.uid()));

-- 2) Block privilege escalation through direct profile updates
CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Server-side writes via the service role (admin server functions) carry no
  -- authenticated user id; those paths enforce their own admin + last-admin checks.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.active IS DISTINCT FROM OLD.active
     OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
    RAISE EXCEPTION 'Privilegierte Profilfelder können nur über die Benutzerverwaltung geändert werden.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileges ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileges
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();