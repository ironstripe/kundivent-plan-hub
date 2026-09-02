/**
 * Server-only backup engine for Kundivent.
 *
 * Two one-way backup layers (Kundivent -> Storage), never the other way round:
 *  - daily structured JSON snapshot of the operational tables
 *  - weekly human-readable Excel emergency export
 *
 * This is an additional safety layer on top of the managed PostgreSQL backups,
 * not a physical database backup.
 */
import * as XLSX from "xlsx";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const BACKUP_BUCKET = "kundivent-backups";
export const SNAPSHOT_SCHEMA_VERSION = 1;

export type BackupType = "database_snapshot" | "excel_export";

/** Critical tables: the run fails when any of these cannot be read. */
const SNAPSHOT_TABLES = [
  "events",
  "event_planning_areas",
  "planning_areas",
  "categories",
  "profiles",
  "event_emails",
  "event_attachments",
  "inbound_email_log",
] as const;

const DAILY_RETENTION_DAYS = 30;
const EXCEL_RETENTION_FILES = 12;

export type BackupResult = {
  runId: string;
  type: BackupType;
  storagePath: string;
  fileSize: number;
  eventCount: number;
  checksum: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateParts(now: Date) {
  return {
    year: String(now.getUTCFullYear()),
    month: pad(now.getUTCMonth() + 1),
    day: pad(now.getUTCDate()),
  };
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Reads a full table in pages; throws when the table cannot be read. */
async function readTable(table: string): Promise<Record<string, unknown>[]> {
  const pageSize = 1000;
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from(table as never)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`Tabelle "${table}" konnte nicht gelesen werden: ${error.message}`);
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

async function startRun(type: BackupType) {
  const { data, error } = await supabaseAdmin
    .from("backup_runs")
    .insert({ backup_type: type, status: "running" })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

async function failRun(runId: string, message: string) {
  await supabaseAdmin
    .from("backup_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: message.slice(0, 500),
    })
    .eq("id", runId);
}

/** Uploads and verifies the object really exists before the run counts as successful. */
async function uploadAndVerify(path: string, body: Uint8Array, contentType: string) {
  const { error } = await supabaseAdmin.storage
    .from(BACKUP_BUCKET)
    .upload(path, body as unknown as ArrayBuffer, { contentType, upsert: true });
  if (error) throw new Error(`Speichern fehlgeschlagen: ${error.message}`);

  const folder = path.slice(0, path.lastIndexOf("/"));
  const name = path.slice(path.lastIndexOf("/") + 1);
  const { data: listed, error: listError } = await supabaseAdmin.storage
    .from(BACKUP_BUCKET)
    .list(folder, { search: name, limit: 100 });
  if (listError) throw new Error(`Prüfung der Sicherung fehlgeschlagen: ${listError.message}`);
  if (!(listed ?? []).some((entry) => entry.name === name)) {
    throw new Error("Die Sicherungsdatei wurde nach dem Schreiben nicht gefunden.");
  }
}

export async function runDatabaseSnapshot(): Promise<BackupResult> {
  const runId = await startRun("database_snapshot");
  try {
    const now = new Date();
    const tables: Record<string, Record<string, unknown>[]> = {};
    for (const table of SNAPSHOT_TABLES) {
      tables[table] = await readTable(table);
    }
    if (!tables["events"] || !tables["planning_areas"] || !tables["categories"]) {
      throw new Error("Kritische Tabellen fehlen im Export.");
    }

    const eventCount = tables["events"]!.length;
    const payload = {
      metadata: {
        application: "Kundivent",
        created_at: now.toISOString(),
        schema_version: SNAPSHOT_SCHEMA_VERSION,
        backup_type: "database_snapshot",
        counts: {
          events: eventCount,
          event_emails: tables["event_emails"]!.length,
          event_attachments: tables["event_attachments"]!.length,
        },
        note: "Anwendungs-Snapshot (keine physische PostgreSQL-Sicherung). Enthält keine Passwörter oder Secrets.",
      },
      tables,
    };

    const bytes = new TextEncoder().encode(JSON.stringify(payload, null, 2));
    const { year, month, day } = dateParts(now);
    const path = `database/${year}/${month}/kundivent-db-${year}-${month}-${day}.json`;
    await uploadAndVerify(path, bytes, "application/json");
    const checksum = await sha256Hex(bytes);

    await supabaseAdmin
      .from("backup_runs")
      .update({
        status: "success",
        completed_at: new Date().toISOString(),
        storage_path: path,
        file_size: bytes.byteLength,
        event_count: eventCount,
      })
      .eq("id", runId);

    await pruneDatabaseSnapshots();
    return { runId, type: "database_snapshot", storagePath: path, fileSize: bytes.byteLength, eventCount, checksum };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, message);
    throw new Error(message);
  }
}

const MAKE_SIGNED_URL_TTL_SECONDS = 15 * 60;
const MAKE_TIMEOUT_MS = 10_000;

async function setExternalStatus(
  runId: string,
  status: "pending" | "success" | "failed",
  error: string | null,
) {
  await supabaseAdmin
    .from("backup_runs")
    .update({
      external_backup_status: status,
      external_backup_at: new Date().toISOString(),
      external_backup_error: error ? error.slice(0, 500) : null,
    })
    .eq("id", runId);
}

/**
 * Notifies the Make webhook so it can copy the generated XLSX to Google Drive.
 * Never throws into the backup flow — the run stays successful either way.
 */
async function notifyMakeExcelBackup(runId: string, storagePath: string, createdAt: string) {
  const webhookUrl = process.env["MAKE_BACKUP_WEBHOOK_URL"];
  const apiKey = process.env["MAKE_BACKUP_WEBHOOK_API_KEY"];
  if (!webhookUrl || !apiKey) {
    await setExternalStatus(runId, "pending", "Make-Webhook nicht konfiguriert.");
    return;
  }

  try {
    const { data: signed, error } = await supabaseAdmin.storage
      .from(BACKUP_BUCKET)
      .createSignedUrl(storagePath, MAKE_SIGNED_URL_TTL_SECONDS, { download: true });
    if (error || !signed?.signedUrl) {
      throw new Error(`Signierter Link fehlgeschlagen: ${error?.message ?? "unbekannt"}`);
    }

    const payload = {
      type: "excel_backup",
      filename: storagePath.slice(storagePath.lastIndexOf("/") + 1),
      download_url: signed.signedUrl,
      created_at: createdAt,
    };

    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "content-type": "application/json", "x-make-apikey": apiKey },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(MAKE_TIMEOUT_MS),
        });
        if (response.ok) {
          await setExternalStatus(runId, "success", null);
          return;
        }
        lastError = `Make antwortete mit Status ${response.status}`;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }
    throw new Error(lastError || "Make-Webhook fehlgeschlagen.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setExternalStatus(runId, "failed", message);
  }
}

function formatTime(value: string | null) {
  return value ? value.slice(0, 5) : "";
}

export async function runExcelExport(): Promise<BackupResult> {
  const runId = await startRun("excel_export");
  try {
    const now = new Date();
    const [events, links, areas, categories, profiles, emails, attachments] = await Promise.all([
      readTable("events"),
      readTable("event_planning_areas"),
      readTable("planning_areas"),
      readTable("categories"),
      readTable("profiles"),
      readTable("event_emails"),
      readTable("event_attachments"),
    ]);

    const areaName = new Map(areas.map((a) => [a["id"] as string, a["name"] as string]));
    const categoryName = new Map(categories.map((c) => [c["id"] as string, c["name"] as string]));
    const personName = new Map(profiles.map((p) => [p["id"] as string, p["display_name"] as string]));
    const areasByEvent = new Map<string, string[]>();
    for (const link of links) {
      const eventId = link["event_id"] as string;
      const name = areaName.get(link["planning_area_id"] as string);
      if (!name) continue;
      areasByEvent.set(eventId, [...(areasByEvent.get(eventId) ?? []), name]);
    }
    const countBy = (rows: Record<string, unknown>[]) => {
      const map = new Map<string, number>();
      for (const row of rows) {
        const id = row["event_id"] as string;
        map.set(id, (map.get(id) ?? 0) + 1);
      }
      return map;
    };
    const emailCount = countBy(emails);
    const attachmentCount = countBy(attachments);

    const statusLabel: Record<string, string> = {
      idea: "Idee",
      provisional: "Provisorisch",
      confirmed: "Bestätigt",
      cancelled: "Abgesagt",
    };

    const planungRows = [...events]
      .sort((a, b) => String(a["start_date"]).localeCompare(String(b["start_date"])))
      .map((event) => ({
        "Event ID": event["id"],
        Titel: event["title"],
        "Datum von": event["start_date"],
        "Datum bis": event["end_date"] ?? event["start_date"],
        Ganztägig: event["all_day"] ? "Ja" : "Nein",
        "Zeit von": formatTime(event["start_time"] as string | null),
        "Zeit bis": formatTime(event["end_time"] as string | null),
        Planungsbereiche: (areasByEvent.get(event["id"] as string) ?? []).join("; "),
        Kategorie: categoryName.get(event["category_id"] as string) ?? "",
        Status: statusLabel[event["status"] as string] ?? String(event["status"]),
        Personen: event["pax"] ?? "",
        Verantwortlich: personName.get(event["responsible_user_id"] as string) ?? "",
        Bemerkungen: event["notes"] ?? "",
        "Anzahl archivierter E-Mails": emailCount.get(event["id"] as string) ?? 0,
        "Anzahl Anhänge": attachmentCount.get(event["id"] as string) ?? 0,
        "letzte Änderung": String(event["updated_at"] ?? "").slice(0, 16).replace("T", " "),
        "erstellt am": String(event["created_at"] ?? "").slice(0, 16).replace("T", " "),
      }));

    const workbook = XLSX.utils.book_new();

    const planung = XLSX.utils.json_to_sheet(planungRows);
    planung["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(planungRows.length, 1), c: 16 } }) };
    planung["!freeze"] = { xSplit: "0", ySplit: "1" };
    planung["!cols"] = [
      38, 34, 12, 12, 10, 10, 10, 30, 20, 14, 10, 20, 40, 14, 12, 18, 18,
    ].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, planung, "Planung");

    const areaSheet = XLSX.utils.json_to_sheet(
      [...areas]
        .sort((a, b) => Number(a["sort_order"]) - Number(b["sort_order"]))
        .map((a) => ({ Name: a["name"], Aktiv: a["active"] ? "Ja" : "Nein", Sortierung: a["sort_order"] })),
    );
    areaSheet["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(workbook, areaSheet, "Planungsbereiche");

    const categorySheet = XLSX.utils.json_to_sheet(
      [...categories]
        .sort((a, b) => Number(a["sort_order"]) - Number(b["sort_order"]))
        .map((c) => ({ Name: c["name"], Aktiv: c["active"] ? "Ja" : "Nein", Sortierung: c["sort_order"] })),
    );
    categorySheet["!cols"] = [{ wch: 30 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(workbook, categorySheet, "Kategorien");

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const bytes = new Uint8Array(buffer);
    const { year, month, day } = dateParts(now);
    const path = `excel/${year}/${month}/Kundivent_Backup_${year}-${month}-${day}.xlsx`;
    await uploadAndVerify(
      path,
      bytes,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const checksum = await sha256Hex(bytes);

    await supabaseAdmin
      .from("backup_runs")
      .update({
        status: "success",
        completed_at: new Date().toISOString(),
        storage_path: path,
        file_size: bytes.byteLength,
        event_count: events.length,
      })
      .eq("id", runId);

    await pruneExcelExports();
    // External copy (Make -> Google Drive) is an extra layer; never fails the backup.
    try {
      await notifyMakeExcelBackup(runId, path, now.toISOString());
    } catch {
      // notifyMakeExcelBackup records its own status
    }
    return { runId, type: "excel_export", storagePath: path, fileSize: bytes.byteLength, eventCount: events.length, checksum };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failRun(runId, message);
    throw new Error(message);
  }
}

/** Lists every generated backup object below a prefix (only our own folders). */
export async function listBackupObjects(prefix: "database" | "excel") {
  const results: { path: string; name: string; size: number | null; createdAt: string | null }[] = [];
  const years = await supabaseAdmin.storage.from(BACKUP_BUCKET).list(prefix, { limit: 100 });
  for (const year of years.data ?? []) {
    if (year.id) continue; // file, not folder
    const months = await supabaseAdmin.storage.from(BACKUP_BUCKET).list(`${prefix}/${year.name}`, { limit: 100 });
    for (const month of months.data ?? []) {
      if (month.id) continue;
      const files = await supabaseAdmin.storage
        .from(BACKUP_BUCKET)
        .list(`${prefix}/${year.name}/${month.name}`, { limit: 1000, sortBy: { column: "name", order: "desc" } });
      for (const file of files.data ?? []) {
        if (!file.id) continue;
        results.push({
          path: `${prefix}/${year.name}/${month.name}/${file.name}`,
          name: file.name,
          size: (file.metadata as { size?: number } | null)?.size ?? null,
          createdAt: file.created_at ?? null,
        });
      }
    }
  }
  return results.sort((a, b) => b.name.localeCompare(a.name));
}

/**
 * Retention: last 30 daily snapshots stay, older ones keep one per ISO week
 * for three months, everything before that is removed.
 */
async function pruneDatabaseSnapshots() {
  const files = await listBackupObjects("database");
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const keptWeeks = new Set<string>();
  const remove: string[] = [];

  for (const file of files) {
    const match = file.name.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!match) continue; // never touch unrelated files
    const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
    const ageDays = (now - date.getTime()) / day;
    if (ageDays <= DAILY_RETENTION_DAYS) continue;
    if (ageDays > DAILY_RETENTION_DAYS + 90) {
      remove.push(file.path);
      continue;
    }
    const week = `${date.getUTCFullYear()}-${Math.floor(date.getTime() / (7 * day))}`;
    if (keptWeeks.has(week)) remove.push(file.path);
    else keptWeeks.add(week);
  }
  if (remove.length) await supabaseAdmin.storage.from(BACKUP_BUCKET).remove(remove);
}

async function pruneExcelExports() {
  const files = (await listBackupObjects("excel")).filter((f) => /^Kundivent_Backup_\d{4}-\d{2}-\d{2}\.xlsx$/.test(f.name));
  const remove = files.slice(EXCEL_RETENTION_FILES).map((f) => f.path);
  if (remove.length) await supabaseAdmin.storage.from(BACKUP_BUCKET).remove(remove);
}

export async function runBackup(type: BackupType) {
  return type === "excel_export" ? runExcelExport() : runDatabaseSnapshot();
}
