import { createFileRoute } from "@tanstack/react-router";

/**
 * Bounded, paginated event search across all dates for the KundiCalc
 * selection step. Returns only what the selection needs — never e-mails,
 * attachments, deposits or unrelated notes.
 */
export const Route = createFileRoute("/api/public/integrations/kundicalc/v1/events")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const mod = await import("@/lib/integrations/kundicalc.server");
        const auth = await mod.authenticate(request);
        if (auth instanceof Response) return auth;

        const url = new URL(request.url);
        const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        const status = url.searchParams.get("status");
        const limitRaw = Number(url.searchParams.get("limit") ?? 20);
        const offsetRaw = Number(url.searchParams.get("offset") ?? 0);
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 20;
        const offset = Number.isFinite(offsetRaw) ? Math.min(Math.max(offsetRaw, 0), 5000) : 0;

        const isDate = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
        const statuses = ["idea", "provisional", "confirmed", "cancelled"];
        if (status && !statuses.includes(status)) return mod.fail("invalid_payload", "status");
        if ((from && !isDate(from)) || (to && !isDate(to))) {
          return mod.fail("invalid_payload", "date_range");
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let query = supabaseAdmin
          .from("events")
          .select(
            "id, title, start_date, end_date, all_day, start_time, end_time, status, pax, updated_at, event_planning_areas(planning_area_id, planning_areas(name))",
            { count: "exact" },
          )
          .order("start_date", { ascending: true })
          .range(offset, offset + limit - 1);

        if (q) query = query.ilike("title", `%${q.replace(/[%_,()]/g, " ")}%`);
        if (from) query = query.gte("start_date", from);
        if (to) query = query.lte("start_date", to);
        if (status) query = query.eq("status", status as never);

        const { data, error, count } = await query;
        if (error) return mod.fail("transaction_failed");

        const rows = (data ?? []) as unknown as {
          id: string;
          title: string;
          start_date: string;
          end_date: string | null;
          all_day: boolean;
          start_time: string | null;
          end_time: string | null;
          status: string;
          pax: number | null;
          updated_at: string;
          event_planning_areas: { planning_area_id: string; planning_areas: { name: string } | null }[];
        }[];

        const linked = new Set<string>();
        if (rows.length) {
          const { data: handovers } = await supabaseAdmin
            .from("integration_handovers")
            .select("target_event_id")
            .in("target_event_id", rows.map((r) => r.id));
          for (const h of handovers ?? []) if (h.target_event_id) linked.add(h.target_event_id);
        }

        return Response.json({
          contract_version: mod.CONTRACT_VERSION,
          total: count ?? rows.length,
          limit,
          offset,
          items: rows.map((row) => {
            const hasAssociation = linked.has(row.id);
            return {
              event_id: row.id,
              title: row.title,
              start_date: row.start_date,
              end_date: row.end_date,
              all_day: row.all_day,
              start_time: row.start_time,
              end_time: row.end_time,
              status: row.status,
              pax: row.pax,
              planning_areas: row.event_planning_areas.map((a) => ({
                id: a.planning_area_id,
                name: a.planning_areas?.name ?? null,
              })),
              updated_at: row.updated_at,
              kundicalc_association: hasAssociation,
              linkable: !hasAssociation && row.status !== "cancelled",
              unavailable_reason: hasAssociation
                ? "association_conflict"
                : row.status === "cancelled"
                  ? "cancelled_target"
                  : null,
            };
          }),
        });
      },
    },
  },
});
