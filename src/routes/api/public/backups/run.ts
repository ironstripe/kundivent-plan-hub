import { createFileRoute } from "@tanstack/react-router";

/**
 * Endpoint for the scheduled backup jobs (pg_cron + pg_net).
 * Authentication uses a random token stored in the database vault; the same
 * server-side logic is reused by the admin "Backup jetzt erstellen" action.
 */
export const Route = createFileRoute("/api/public/backups/run")({
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

        let type: string = "database_snapshot";
        try {
          const body = (await request.json()) as { type?: string };
          if (body?.type) type = body.type;
        } catch {
          // empty body -> default type
        }
        if (type !== "database_snapshot" && type !== "excel_export") {
          return Response.json({ error: "invalid type" }, { status: 400 });
        }

        const { runBackup } = await import("@/lib/backup.server");
        try {
          const result = await runBackup(type);
          return Response.json({ ok: true, ...result });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
