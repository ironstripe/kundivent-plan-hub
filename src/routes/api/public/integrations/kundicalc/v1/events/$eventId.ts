import { createFileRoute } from "@tanstack/react-router";

/** Single event preview for the KundiCalc review step (read-only). */
export const Route = createFileRoute("/api/public/integrations/kundicalc/v1/events/$eventId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const mod = await import("@/lib/integrations/kundicalc.server");
        const auth = await mod.authenticate(request);
        if (auth instanceof Response) return auth;

        const eventId = String(params.eventId ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(eventId)) return mod.fail("invalid_payload", "event_id");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("events")
          .select(
            "id, title, start_date, end_date, all_day, start_time, end_time, status, pax, category_id, updated_at, event_planning_areas(planning_area_id, planning_areas(name))",
          )
          .eq("id", eventId)
          .maybeSingle();
        if (error) return mod.fail("transaction_failed");
        if (!data) return mod.fail("target_not_found");

        const row = data as unknown as {
          id: string;
          title: string;
          start_date: string;
          end_date: string | null;
          all_day: boolean;
          start_time: string | null;
          end_time: string | null;
          status: string;
          pax: number | null;
          category_id: string;
          updated_at: string;
          event_planning_areas: { planning_area_id: string; planning_areas: { name: string } | null }[];
        };

        const { data: handover } = await supabaseAdmin
          .from("integration_handovers")
          .select("id, source_event_id, completed_at")
          .eq("target_event_id", row.id)
          .maybeSingle();

        return Response.json({
          contract_version: mod.CONTRACT_VERSION,
          event_id: row.id,
          title: row.title,
          start_date: row.start_date,
          end_date: row.end_date,
          all_day: row.all_day,
          start_time: row.start_time,
          end_time: row.end_time,
          status: row.status,
          pax: row.pax,
          category_id: row.category_id,
          planning_areas: row.event_planning_areas.map((a) => ({
            id: a.planning_area_id,
            name: a.planning_areas?.name ?? null,
          })),
          updated_at: row.updated_at,
          kundicalc_association: handover
            ? {
                handover_id: handover.id,
                source_event_id: handover.source_event_id,
                completed_at: handover.completed_at,
              }
            : null,
          linkable: !handover && row.status !== "cancelled",
          target_url: mod.targetUrl(auth.config, request, row.id),
        });
      },
    },
  },
});
