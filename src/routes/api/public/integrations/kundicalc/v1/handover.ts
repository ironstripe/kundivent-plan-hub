import { createFileRoute } from "@tanstack/react-router";

/**
 * KundiCalc → Kundivent handover receiver (contract v1).
 * Creates a confirmed event or links an approved calculation to an existing
 * idea/provisional entry. Idempotent and transactional.
 */
export const Route = createFileRoute("/api/public/integrations/kundicalc/v1/handover")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const mod = await import("@/lib/integrations/kundicalc.server");
        const auth = await mod.authenticate(request);
        if (auth instanceof Response) return auth;
        const denied = mod.requireWriteAccess(auth.actor);
        if (denied) return denied;

        const body = await mod.readJsonBody(request);
        if (body instanceof Response) return body;

        const parsed = mod.handoverSchema.safeParse(body);
        if (!parsed.success) {
          return mod.fail("invalid_payload", parsed.error.issues[0]?.path.join(".") || "schema");
        }
        const payload = parsed.data;

        if (payload.source_system !== auth.config.sourceSystem) {
          return mod.fail("invalid_payload", "source_system");
        }
        if (payload.source_actor_id !== auth.actor.sourceActorId) {
          return mod.fail("invalid_payload", "source_actor_id");
        }

        if (payload.operation === "create") {
          const invalid = mod.validateCreateFields(payload.event);
          if (invalid) return mod.fail(invalid, "event_fields");
        }

        const fp = await mod.fingerprint(payload);
        const calculationUrl = mod.calculationUrl(auth.config, payload.source_calculation_id);

        const rpcPayload: Record<string, unknown> = {
          contract_version: payload.contract_version,
          source_system: payload.source_system,
          source_event_id: payload.source_event_id,
          source_calculation_id: payload.source_calculation_id ?? null,
          source_actor_id: payload.source_actor_id,
          actor_profile_id: auth.actor.profileId,
          execution_approval_ref: payload.execution_approval_ref,
          execution_approved_at: payload.execution_approved_at,
          idempotency_key: payload.idempotency_key,
          request_fingerprint: fp,
          operation: payload.operation,
          calculation_url: calculationUrl,
        };

        if (payload.operation === "create") {
          Object.assign(rpcPayload, {
            title: payload.event.title.trim(),
            category_id: payload.event.category_id,
            planning_area_ids: payload.event.planning_area_ids,
            start_date: payload.event.start_date,
            end_date: payload.event.end_date ?? null,
            all_day: payload.event.all_day,
            start_time: payload.event.all_day ? null : (payload.event.start_time ?? null),
            end_time: payload.event.all_day ? null : (payload.event.end_time ?? null),
            pax: payload.event.pax ?? null,
            notes: payload.event.notes ?? null,
            responsible_user_id: payload.event.responsible_user_id ?? null,
          });
        } else {
          Object.assign(rpcPayload, {
            target_event_id: payload.target_event_id,
            expected_updated_at: payload.expected_updated_at,
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc(
          "kundicalc_handover" as never,
          { _payload: rpcPayload } as never,
        );
        if (error) {
          console.error("[kundicalc] handover failed", error.message);
          return mod.fail("transaction_failed");
        }

        const result = data as
          | { ok: true; outcome: string; receipt: Record<string, unknown> }
          | { ok: false; code: string };

        if (!result?.ok) {
          const code = mod.isErrorCode(result?.code) ? result.code : "transaction_failed";
          return mod.fail(code);
        }

        const receipt = result.receipt;
        return Response.json(
          {
            contract_version: mod.CONTRACT_VERSION,
            handover_id: receipt["handover_id"],
            source_event_id: receipt["source_event_id"],
            source_calculation_id: receipt["source_calculation_id"],
            target_event_id: receipt["target_event_id"],
            target_url: mod.targetUrl(auth.config, request, String(receipt["target_event_id"])),
            calculation_url: receipt["calculation_url"],
            operation: receipt["operation"],
            outcome: result.outcome,
            completed_at: receipt["completed_at"],
            target_event_deleted: receipt["target_event_deleted"],
          },
          { status: result.outcome === "already_processed" ? 200 : 201 },
        );
      },
    },
  },
});
