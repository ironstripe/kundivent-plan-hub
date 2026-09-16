-- 1. Mapping between a trusted source application's user id and a Kundivent user
CREATE TABLE public.integration_user_map (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  source_actor_id text NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_system, source_actor_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.integration_user_map TO authenticated;
GRANT ALL ON public.integration_user_map TO service_role;

ALTER TABLE public.integration_user_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage integration user map"
  ON public.integration_user_map FOR ALL TO authenticated
  USING (public.is_active_admin(auth.uid()))
  WITH CHECK (public.is_active_admin(auth.uid()));

CREATE TRIGGER trg_integration_user_map_updated_at
  BEFORE UPDATE ON public.integration_user_map
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Handover receipts
CREATE TABLE public.integration_handovers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system text NOT NULL,
  source_event_id text NOT NULL,
  source_calculation_id text,
  source_actor_id text NOT NULL,
  actor_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  execution_approval_ref text,
  execution_approved_at timestamptz,
  idempotency_key text NOT NULL,
  request_fingerprint text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('create', 'link')),
  outcome text NOT NULL CHECK (outcome IN ('created', 'linked')),
  target_event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  target_event_ref uuid NOT NULL,
  target_event_deleted boolean NOT NULL DEFAULT false,
  calculation_url text,
  contract_version text NOT NULL DEFAULT 'v1',
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX integration_handovers_source_event_key
  ON public.integration_handovers (source_system, source_event_id);
CREATE UNIQUE INDEX integration_handovers_idempotency_key
  ON public.integration_handovers (source_system, idempotency_key);
CREATE UNIQUE INDEX integration_handovers_target_event_key
  ON public.integration_handovers (target_event_id)
  WHERE target_event_id IS NOT NULL;

GRANT SELECT ON public.integration_handovers TO authenticated;
GRANT ALL ON public.integration_handovers TO service_role;

ALTER TABLE public.integration_handovers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read handovers"
  ON public.integration_handovers FOR SELECT TO authenticated
  USING (true);

-- Keep the receipt when a linked event is deleted in Kundivent
CREATE OR REPLACE FUNCTION public.mark_handover_target_deleted()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE public.integration_handovers
     SET target_event_deleted = true
   WHERE target_event_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_events_mark_handover_deleted
  BEFORE DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.mark_handover_target_deleted();

-- 3. Receipt helper
CREATE OR REPLACE FUNCTION public.kundicalc_receipt(_row public.integration_handovers)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'handover_id', _row.id,
    'contract_version', _row.contract_version,
    'source_system', _row.source_system,
    'source_event_id', _row.source_event_id,
    'source_calculation_id', _row.source_calculation_id,
    'target_event_id', _row.target_event_ref,
    'operation', _row.operation,
    'outcome', _row.outcome,
    'completed_at', _row.completed_at,
    'calculation_url', _row.calculation_url,
    'target_event_deleted', _row.target_event_deleted
  )
$$;

REVOKE ALL ON FUNCTION public.kundicalc_receipt(public.integration_handovers) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kundicalc_receipt(public.integration_handovers) TO service_role;

-- 4. Transactional handover procedure (create or link)
CREATE OR REPLACE FUNCTION public.kundicalc_handover(_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_source_system text := _payload->>'source_system';
  v_source_event_id text := _payload->>'source_event_id';
  v_idem text := _payload->>'idempotency_key';
  v_fp text := _payload->>'request_fingerprint';
  v_operation text := _payload->>'operation';
  v_profile_id uuid := nullif(_payload->>'actor_profile_id', '')::uuid;
  v_role user_role;
  v_active boolean;
  v_existing public.integration_handovers;
  v_event public.events;
  v_event_id uuid;
  v_outcome text;
  v_areas uuid[];
  v_area_count int;
  v_category_ok boolean;
  v_expected timestamptz;
  v_responsible uuid;
  v_new public.integration_handovers;
BEGIN
  IF v_source_system IS NULL OR v_source_event_id IS NULL OR v_idem IS NULL
     OR v_fp IS NULL OR v_profile_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  SELECT role, active INTO v_role, v_active FROM public.profiles WHERE id = v_profile_id;
  IF v_role IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'unmapped_source_user');
  END IF;
  IF NOT v_active THEN
    RETURN jsonb_build_object('ok', false, 'code', 'inactive_user');
  END IF;
  IF v_role NOT IN ('editor', 'admin') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'insufficient_permissions');
  END IF;

  SELECT * INTO v_existing FROM public.integration_handovers
   WHERE source_system = v_source_system AND source_event_id = v_source_event_id;
  IF FOUND THEN
    IF v_existing.idempotency_key = v_idem AND v_existing.request_fingerprint = v_fp THEN
      RETURN jsonb_build_object('ok', true, 'outcome', 'already_processed',
                                'receipt', public.kundicalc_receipt(v_existing));
    ELSIF v_existing.idempotency_key = v_idem THEN
      RETURN jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
    ELSE
      RETURN jsonb_build_object('ok', false, 'code', 'association_conflict');
    END IF;
  END IF;

  SELECT * INTO v_existing FROM public.integration_handovers
   WHERE source_system = v_source_system AND idempotency_key = v_idem;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'idempotency_conflict');
  END IF;

  IF v_operation = 'create' THEN
    SELECT array(SELECT jsonb_array_elements_text(coalesce(_payload->'planning_area_ids', '[]'::jsonb))::uuid)
      INTO v_areas;
    IF v_areas IS NULL OR cardinality(v_areas) = 0 THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invalid_planning_area');
    END IF;
    SELECT count(*) INTO v_area_count FROM public.planning_areas
     WHERE id = ANY(v_areas) AND active;
    IF v_area_count <> cardinality(v_areas) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invalid_planning_area');
    END IF;

    SELECT true INTO v_category_ok FROM public.categories
     WHERE id = (_payload->>'category_id')::uuid AND active;
    IF v_category_ok IS NOT TRUE THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invalid_category');
    END IF;

    v_responsible := nullif(_payload->>'responsible_user_id', '')::uuid;
    IF v_responsible IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_responsible AND active) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invalid_responsible_user');
    END IF;

    INSERT INTO public.events (
      title, category_id, start_date, end_date, all_day, start_time, end_time,
      status, pax, notes, responsible_user_id, created_by, external_source, external_id,
      sync_status, last_synced_at
    ) VALUES (
      _payload->>'title',
      (_payload->>'category_id')::uuid,
      (_payload->>'start_date')::date,
      nullif(_payload->>'end_date', '')::date,
      coalesce((_payload->>'all_day')::boolean, true),
      nullif(_payload->>'start_time', '')::time,
      nullif(_payload->>'end_time', '')::time,
      'confirmed'::event_status,
      nullif(_payload->>'pax', '')::int,
      nullif(_payload->>'notes', ''),
      v_responsible,
      v_profile_id,
      v_source_system,
      v_source_event_id,
      'handover',
      now()
    ) RETURNING id INTO v_event_id;

    INSERT INTO public.event_planning_areas (event_id, planning_area_id)
    SELECT v_event_id, unnest(v_areas);

    v_outcome := 'created';

  ELSIF v_operation = 'link' THEN
    SELECT * INTO v_event FROM public.events
     WHERE id = nullif(_payload->>'target_event_id', '')::uuid
     FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'code', 'target_not_found');
    END IF;

    v_expected := nullif(_payload->>'expected_updated_at', '')::timestamptz;
    IF v_expected IS NULL OR v_event.updated_at <> v_expected THEN
      RETURN jsonb_build_object('ok', false, 'code', 'target_changed');
    END IF;

    IF v_event.status = 'cancelled'::event_status THEN
      RETURN jsonb_build_object('ok', false, 'code', 'cancelled_target');
    END IF;

    IF EXISTS (SELECT 1 FROM public.integration_handovers WHERE target_event_id = v_event.id) THEN
      RETURN jsonb_build_object('ok', false, 'code', 'association_conflict');
    END IF;

    IF v_event.status IN ('idea'::event_status, 'provisional'::event_status) THEN
      UPDATE public.events SET status = 'confirmed'::event_status WHERE id = v_event.id;
    END IF;

    v_event_id := v_event.id;
    v_outcome := 'linked';
  ELSE
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_payload');
  END IF;

  INSERT INTO public.integration_handovers (
    source_system, source_event_id, source_calculation_id, source_actor_id,
    actor_profile_id, execution_approval_ref, execution_approved_at,
    idempotency_key, request_fingerprint, operation, outcome,
    target_event_id, target_event_ref, calculation_url, contract_version
  ) VALUES (
    v_source_system,
    v_source_event_id,
    nullif(_payload->>'source_calculation_id', ''),
    _payload->>'source_actor_id',
    v_profile_id,
    nullif(_payload->>'execution_approval_ref', ''),
    nullif(_payload->>'execution_approved_at', '')::timestamptz,
    v_idem,
    v_fp,
    v_operation,
    v_outcome,
    v_event_id,
    v_event_id,
    nullif(_payload->>'calculation_url', ''),
    coalesce(nullif(_payload->>'contract_version', ''), 'v1')
  ) RETURNING * INTO v_new;

  RETURN jsonb_build_object('ok', true, 'outcome', v_outcome,
                            'receipt', public.kundicalc_receipt(v_new));

EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO v_existing FROM public.integration_handovers
     WHERE source_system = v_source_system AND source_event_id = v_source_event_id;
    IF FOUND AND v_existing.idempotency_key = v_idem AND v_existing.request_fingerprint = v_fp THEN
      RETURN jsonb_build_object('ok', true, 'outcome', 'already_processed',
                                'receipt', public.kundicalc_receipt(v_existing));
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'association_conflict');
END;
$fn$;

REVOKE ALL ON FUNCTION public.kundicalc_handover(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.kundicalc_handover(jsonb) TO service_role;