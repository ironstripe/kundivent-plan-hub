-- Planning areas: read for all authenticated, write only for active admins
DROP POLICY IF EXISTS "Authenticated users manage planning areas" ON public.planning_areas;
CREATE POLICY "Authenticated users can read planning areas"
  ON public.planning_areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage planning areas"
  ON public.planning_areas FOR ALL TO authenticated
  USING (public.is_active_admin(auth.uid()))
  WITH CHECK (public.is_active_admin(auth.uid()));

-- Categories: read for all authenticated, write only for active admins
DROP POLICY IF EXISTS "Authenticated users manage categories" ON public.categories;
CREATE POLICY "Authenticated users can read categories"
  ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage categories"
  ON public.categories FOR ALL TO authenticated
  USING (public.is_active_admin(auth.uid()))
  WITH CHECK (public.is_active_admin(auth.uid()));

-- Profiles: block privilege escalation on privileged columns
CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW; -- server-side/service_role or trigger-driven writes
  END IF;

  IF (NEW.is_admin IS DISTINCT FROM OLD.is_admin
      OR NEW.active IS DISTINCT FROM OLD.active
      OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password)
     AND NOT public.is_active_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Keine Berechtigung, privilegierte Profilfelder zu ändern.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_privileges ON public.profiles;
CREATE TRIGGER trg_guard_profile_privileges
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();

-- Explicit self-service update policy limited to the own row (privileged
-- columns still blocked by the trigger above)
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
