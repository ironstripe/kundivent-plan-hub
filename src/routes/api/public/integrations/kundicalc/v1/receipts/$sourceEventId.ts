import { createFileRoute } from "@tanstack/react-router";

/**
 * Lost-response recovery: returns the original handover receipt for a source
 * event. Read-only, never recreates anything.
 */
export const Route = createFileRoute(
  "/api/public/integrations/kundicalc/v1/receipts/$sourceEventId",
)({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const mod = await import("@/lib/integrations/kundicalc.server");
        const auth = await mod.authenticate(request);
        if (auth instanceof Response) return auth;

        const sourceEventId = String(params.sourceEventId ?? "").slice(0, 128);
        if (!sourceEventId) return mod.fail("invalid_payload", "source_event_id");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("integration_handovers")
          .select(
            "id, source_event_id, source_calculation_id, target_event_ref, operation, outcome, completed_at, calculation_url, target_event_deleted, contract_version",
          )
          .eq("source_system", auth.config.sourceSystem)
          .eq("source_event_id", sourceEventId)
          .maybeSingle();
        if (error) return mod.fail("transaction_failed");
        if (!data) return mod.fail("not_found");

        return Response.json({
          contract_version: data.contract_version,
          handover_id: data.id,
          source_event_id: data.source_event_id,
          source_calculation_id: data.source_calculation_id,
          target_event_id: data.target_event_ref,
          target_url: mod.targetUrl(auth.config, request, data.target_event_ref),
          calculation_url: data.calculation_url,
          operation: data.operation,
          outcome: "already_processed",
          original_outcome: data.outcome,
          completed_at: data.completed_at,
          target_event_deleted: data.target_event_deleted,
        });
      },
    },
  },
});
