import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, DatabaseBackup, FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getBackupDownloadUrl,
  getBackupOverview,
  triggerBackup,
  type BackupFile,
  type BackupRun,
} from "@/lib/backups.functions";

function formatDateTime(value: string | null | undefined) {
  if (!value) return "–";
  return new Date(value).toLocaleString("de-CH", {
    timeZone: "Europe/Zurich",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatSize(bytes: number | null | undefined) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusLine({ runs, type }: { runs: BackupRun[]; type: BackupRun["backup_type"] }) {
  const relevant = runs.filter((r) => r.backup_type === type);
  const last = relevant[0];
  const lastSuccess = relevant.find((r) => r.status === "success");
  if (!last) {
    return <p className="text-[11px] text-muted-foreground">Noch keine Sicherung ausgeführt.</p>;
  }
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] text-muted-foreground">
        Letzte Sicherung: {formatDateTime(lastSuccess?.completed_at ?? lastSuccess?.started_at)}
        {lastSuccess?.event_count != null ? ` · ${lastSuccess.event_count} Einträge` : ""}
      </p>
      {last.status === "failed" ? (
        <p className="text-[11px] text-destructive">
          Letzte Sicherung fehlgeschlagen ({formatDateTime(last.completed_at ?? last.started_at)}):{" "}
          {last.error_message ?? "unbekannter Fehler"}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Status: {last.status === "success" ? "Erfolgreich" : "Läuft"}
        </p>
      )}
    </div>
  );
}

function FileList({
  files,
  onDownload,
  emptyLabel,
}: {
  files: BackupFile[];
  onDownload: (path: string) => void;
  emptyLabel: string;
}) {
  if (!files.length) return <p className="text-[11px] text-muted-foreground">{emptyLabel}</p>;
  return (
    <ul className="divide-y divide-border rounded-sm border border-border">
      {files.map((file) => (
        <li key={file.path} className="flex items-center justify-between gap-2 px-2 py-1.5">
          <span className="truncate text-[11px]">{file.name}</span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-[11px] text-muted-foreground">{formatSize(file.size)}</span>
            <Button size="sm" variant="ghost" className="h-6 px-2" onClick={() => onDownload(file.path)}>
              <Download className="h-3.5 w-3.5" />
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Admin-only overview of the automated backups (status, manual run, download). */
export function BackupAdmin() {
  const queryClient = useQueryClient();
  const overviewFn = useServerFn(getBackupOverview);
  const triggerFn = useServerFn(triggerBackup);
  const downloadFn = useServerFn(getBackupDownloadUrl);
  const [busy, setBusy] = useState<string | null>(null);

  const overview = useQuery({
    queryKey: ["backup_overview"],
    queryFn: () => overviewFn({ data: undefined as never }),
  });

  async function run(type: BackupRun["backup_type"]) {
    setBusy(type);
    try {
      const result = await triggerFn({ data: { type } });
      toast.success(
        type === "excel_export"
          ? `Excel-Notfallkopie erstellt (${result.eventCount} Einträge).`
          : `Datenbank-Snapshot erstellt (${result.eventCount} Einträge).`,
      );
      await queryClient.invalidateQueries({ queryKey: ["backup_overview"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sicherung fehlgeschlagen.");
      await queryClient.invalidateQueries({ queryKey: ["backup_overview"] });
    } finally {
      setBusy(null);
    }
  }

  async function download(path: string) {
    try {
      const { url } = await downloadFn({ data: { path } });
      window.open(url, "_blank", "noopener");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download fehlgeschlagen.");
    }
  }

  const runs = overview.data?.runs ?? [];

  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">Datensicherung</h2>
        <span className="text-[11px] text-muted-foreground">Automatisch, Zeiten in Europe/Zurich</span>
      </div>

      {overview.isLoading ? <p className="text-[11px] text-muted-foreground">Wird geladen…</p> : null}
      {overview.isError ? (
        <p className="text-[11px] text-destructive">
          {(overview.error as Error)?.message ?? "Status konnte nicht geladen werden."}
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2 rounded-sm border border-border p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <DatabaseBackup className="h-3.5 w-3.5" /> Datenbank-Sicherung
            </p>
            <Badge variant="outline" className="text-[11px] font-normal">
              Täglich 02:30
            </Badge>
          </div>
          <StatusLine runs={runs} type="database_snapshot" />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={busy !== null}
            onClick={() => run("database_snapshot")}
          >
            {busy === "database_snapshot" ? "Wird erstellt…" : "Backup jetzt erstellen"}
          </Button>
          <FileList
            files={overview.data?.databaseFiles ?? []}
            onDownload={download}
            emptyLabel="Noch keine Snapshots vorhanden."
          />
        </div>

        <div className="space-y-2 rounded-sm border border-border p-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel-Notfallkopie
            </p>
            <Badge variant="outline" className="text-[11px] font-normal">
              Wöchentlich Mo 03:00
            </Badge>
          </div>
          <StatusLine runs={runs} type="excel_export" />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={busy !== null}
            onClick={() => run("excel_export")}
          >
            {busy === "excel_export" ? "Wird erstellt…" : "Backup jetzt erstellen"}
          </Button>
          <FileList
            files={overview.data?.excelFiles ?? []}
            onDownload={download}
            emptyLabel="Noch keine Excel-Kopien vorhanden."
          />
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Sicherungen liegen privat im Backup-Speicher und dienen als zusätzliche Sicherheitsebene neben der
        verwalteten Datenbanksicherung. Excel ist nur eine Notfall-Lesekopie – kein Rückimport.
      </p>
    </section>
  );
}
