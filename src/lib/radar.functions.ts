import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RadarSourceStatus = {
  id: string;
  name: string;
  source_type: string;
  active: boolean;
  sync_enabled: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  last_sync_summary: string | null;
  entry_count: number;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("is_admin, active")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error("Berechtigung konnte nicht geprüft werden.");
  if (!data?.active || !data?.is_admin) throw new Error("Keine Berechtigung für die Radar-Quellen.");
}

/** Source registry plus stored entry counts — visible to admins in settings. */
export const getRadarSourceStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: sources, error }, { data: events, error: eventsError }] = await Promise.all([
      supabaseAdmin.from("radar_sources").select("*").order("source_type"),
      supabaseAdmin.from("radar_events").select("source_id").eq("active", true),
    ]);
    if (error) throw new Error(error.message);
    if (eventsError) throw new Error(eventsError.message);

    const counts = new Map<string, number>();
    for (const row of events ?? []) {
      counts.set(row.source_id, (counts.get(row.source_id) ?? 0) + 1);
    }

    return (sources ?? []).map((s) => ({
      ...s,
      entry_count: counts.get(s.id) ?? 0,
    })) as RadarSourceStatus[];
  });

/** Admin action "Jetzt synchronisieren" — same engine as the scheduled job. */
export const syncRadarSources = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { sourceId?: string } | undefined) => ({
    sourceId: input?.sourceId ? String(input.sourceId) : undefined,
  }))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { runRadarSync } = await import("@/lib/radar/sync.server");
    return { results: await runRadarSync(data.sourceId) };
  });
