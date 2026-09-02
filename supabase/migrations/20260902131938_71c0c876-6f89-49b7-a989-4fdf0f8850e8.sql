-- 1. Rollen ---------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('viewer', 'editor', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role public.user_role NOT NULL DEFAULT 'editor';

UPDATE public.profiles SET role = CASE WHEN is_admin THEN 'admin'::public.user_role ELSE 'editor'::public.user_role END;

-- is_admin bleibt als abgeleitete Spalte erhalten (Kompatibilität), Quelle der Wahrheit ist role.
ALTER TABLE public.profiles DROP COLUMN is_admin;
ALTER TABLE public.profiles ADD COLUMN is_admin boolean GENERATED ALWAYS AS (role = 'admin') STORED;

CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.active IS DISTINCT FROM OLD.active
     OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
    RAISE EXCEPTION 'Privilegierte Profilfelder können nur über die Benutzerverwaltung geändert werden.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND active = true
$$;

CREATE OR REPLACE FUNCTION public.is_active_editor_or_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND active = true AND role IN ('editor', 'admin')
  )
$$;

-- 2. Löschrechte je Planungsbereich ---------------------------------------
CREATE TABLE IF NOT EXISTS public.profile_planning_area_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  planning_area_id uuid NOT NULL REFERENCES public.planning_areas(id) ON DELETE CASCADE,
  can_delete boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id, planning_area_id)
);

GRANT SELECT ON public.profile_planning_area_permissions TO authenticated;
GRANT ALL ON public.profile_planning_area_permissions TO service_role;

ALTER TABLE public.profile_planning_area_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own delete permissions" ON public.profile_planning_area_permissions;
CREATE POLICY "Users read own delete permissions"
ON public.profile_planning_area_permissions FOR SELECT TO authenticated
USING (profile_id = auth.uid() OR public.is_active_admin(auth.uid()));

CREATE TRIGGER trg_ppap_updated_at
BEFORE UPDATE ON public.profile_planning_area_permissions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Löschautorisierung ----------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_delete_event(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    CASE
      WHEN public.is_active_admin(_user_id) THEN true
      WHEN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = _user_id AND active = true AND role = 'editor'
      ) THEN
        EXISTS (SELECT 1 FROM public.event_planning_areas WHERE event_id = _event_id)
        AND NOT EXISTS (
          SELECT 1
          FROM public.event_planning_areas epa
          WHERE epa.event_id = _event_id
            AND NOT EXISTS (
              SELECT 1 FROM public.profile_planning_area_permissions p
              WHERE p.profile_id = _user_id
                AND p.planning_area_id = epa.planning_area_id
                AND p.can_delete = true
            )
        )
      ELSE false
    END
$$;

-- 4. Neue Policies für Einträge -------------------------------------------
DROP POLICY IF EXISTS "Authenticated users manage events" ON public.events;

CREATE POLICY "Authenticated users read events"
ON public.events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editors and admins create events"
ON public.events FOR INSERT TO authenticated
WITH CHECK (public.is_active_editor_or_admin(auth.uid()));

CREATE POLICY "Editors and admins update events"
ON public.events FOR UPDATE TO authenticated
USING (public.is_active_editor_or_admin(auth.uid()))
WITH CHECK (public.is_active_editor_or_admin(auth.uid()));

CREATE POLICY "Delete events with permission"
ON public.events FOR DELETE TO authenticated
USING (public.can_delete_event(auth.uid(), id));

DROP POLICY IF EXISTS "Authenticated users manage event planning areas" ON public.event_planning_areas;

CREATE POLICY "Authenticated users read event planning areas"
ON public.event_planning_areas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Editors and admins manage event planning areas"
ON public.event_planning_areas FOR INSERT TO authenticated
WITH CHECK (public.is_active_editor_or_admin(auth.uid()));

CREATE POLICY "Editors and admins update event planning areas"
ON public.event_planning_areas FOR UPDATE TO authenticated
USING (public.is_active_editor_or_admin(auth.uid()))
WITH CHECK (public.is_active_editor_or_admin(auth.uid()));

CREATE POLICY "Editors and admins delete event planning areas"
ON public.event_planning_areas FOR DELETE TO authenticated
USING (public.is_active_editor_or_admin(auth.uid()));

-- Anhänge: Betrachter nur lesen
DROP POLICY IF EXISTS "Authenticated users add attachments" ON public.event_attachments;
DROP POLICY IF EXISTS "Authenticated users delete attachments" ON public.event_attachments;

CREATE POLICY "Editors and admins add attachments"
ON public.event_attachments FOR INSERT TO authenticated
WITH CHECK (public.is_active_editor_or_admin(auth.uid()));

CREATE POLICY "Editors and admins delete attachments"
ON public.event_attachments FOR DELETE TO authenticated
USING (public.is_active_editor_or_admin(auth.uid()));

-- Manuelle Radar-Einträge: nur Bearbeiter/Admins
DROP POLICY IF EXISTS "Authenticated users create manual radar events" ON public.radar_events;
DROP POLICY IF EXISTS "Authenticated users update manual radar events" ON public.radar_events;
DROP POLICY IF EXISTS "Authenticated users delete manual radar events" ON public.radar_events;

CREATE POLICY "Editors create manual radar events"
ON public.radar_events FOR INSERT TO authenticated
WITH CHECK (is_manual = true AND public.is_active_editor_or_admin(auth.uid()));

CREATE POLICY "Editors update manual radar events"
ON public.radar_events FOR UPDATE TO authenticated
USING (is_manual = true AND public.is_active_editor_or_admin(auth.uid()))
WITH CHECK (is_manual = true AND public.is_active_editor_or_admin(auth.uid()));

CREATE POLICY "Editors delete manual radar events"
ON public.radar_events FOR DELETE TO authenticated
USING (is_manual = true AND public.is_active_editor_or_admin(auth.uid()));