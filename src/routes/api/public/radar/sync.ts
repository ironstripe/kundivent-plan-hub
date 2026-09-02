import { createFileRoute } from "@tanstack/react-router";

/**
 * Endpoint for the scheduled Radar synchronization (pg_cron + pg_net).
 * Authenticated with the same random cron token stored in the database vault
 * that the backup job uses; the sync logic is shared with the admin action.
 */
export const Route = createFileRoute("/api/public/radar/sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("x-backup-token") ?? "";
        if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: valid, error } = await supabaseAdmin.rpc(
          "verify_backup_token" as never,
          { _token: token } as never,
        );
        if (error || valid !== true) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }

        // Optional { "sourceId": "..." } narrows the run to a single source.
        let sourceId: string | undefined;
        try {
          const body = (await request.clone().json()) as { sourceId?: unknown };
          if (typeof body?.sourceId === "string" && body.sourceId) sourceId = body.sourceId;
        } catch {
          // no or invalid body → full sync
        }

        const { runRadarSync } = await import("@/lib/radar/sync.server");
        try {
          const results = await runRadarSync(sourceId);
          return Response.json({ ok: true, results });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
