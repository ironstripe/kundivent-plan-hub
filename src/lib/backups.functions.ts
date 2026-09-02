import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type BackupRun = {
  id: string;
  backup_type: "database_snapshot" | "excel_export";
  started_at: string;
  completed_at: string | null;
  status: "running" | "success" | "failed";
  storage_path: string | null;
  file_size: number | null;
  event_count: number | null;
  error_message: string | null;
  external_backup_status?: "pending" | "success" | "failed" | null;
  external_backup_at?: string | null;
  external_backup_error?: string | null;
};

export type BackupFile = {
  path: string;
  name: string;
  size: number | null;
  createdAt: string | null;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("is_admin, active")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error("Berechtigung konnte nicht geprüft werden.");
  if (!data?.active || !data?.is_admin) throw new Error("Keine Berechtigung für die Datensicherung.");
}

/** Status overview: latest runs plus the recent downloadable files. */
export const getBackupOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { listBackupObjects } = await import("@/lib/backup.server");

    const { data: runs, error } = await supabaseAdmin
      .from("backup_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);

    const [excelFiles, dbFiles] = await Promise.all([
      listBackupObjects("excel"),
      listBackupObjects("database"),
    ]);

    return {
      runs: (runs ?? []) as BackupRun[],
      excelFiles: excelFiles.slice(0, 12) as BackupFile[],
      databaseFiles: dbFiles.slice(0, 12) as BackupFile[],
    };
  });

/** Admin trigger — same server-side logic as the scheduled jobs. */
export const triggerBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { type: "database_snapshot" | "excel_export" }) => {
    if (input?.type !== "database_snapshot" && input?.type !== "excel_export") {
      throw new Error("Unbekannter Sicherungstyp.");
    }
    return input;
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { runBackup } = await import("@/lib/backup.server");
    const result = await runBackup(data.type);
    return { storagePath: result.storagePath, fileSize: result.fileSize, eventCount: result.eventCount };
  });

/** Short-lived signed URL for a backup file in the private bucket. */
export const getBackupDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { path: string }) => {
    const path = String(input?.path ?? "");
    if (!/^(database|excel)\/\d{4}\/\d{2}\/[\w.\-]+$/.test(path)) {
      throw new Error("Ungültiger Dateipfad.");
    }
    return { path };
  })
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { BACKUP_BUCKET } = await import("@/lib/backup.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BACKUP_BUCKET)
      .createSignedUrl(data.path, 300, { download: true });
    if (error || !signed?.signedUrl) throw new Error("Download-Link konnte nicht erstellt werden.");
    return { url: signed.signedUrl };
  });
