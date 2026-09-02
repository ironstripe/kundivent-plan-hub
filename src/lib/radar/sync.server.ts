/**
 * Server-only Radar synchronization.
 *
 * External data is fetched here (never in the browser), normalized through the
 * source adapters and upserted into `radar_events`. Failed syncs keep the
 * previously stored data and only record the error on the source registry.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  openHolidaysPublicAdapter,
  openHolidaysSchoolAdapter,
} from "@/lib/radar/adapters/openholidays";
import {
  frauenfeldAdapter,
  schaffhauserlandAdapter,
} from "@/lib/radar/adapters/regional";
import { steinAmRheinAdapter } from "@/lib/radar/adapters/stein-am-rhein";
import {
  syncHorizon,
  type NormalizedRadarEvent,
  type RadarSourceAdapter,
  type RadarSyncContext,
  type RadarSyncStats,
} from "@/lib/radar/types";

export const RADAR_ADAPTERS: RadarSourceAdapter[] = [
  openHolidaysSchoolAdapter,
  openHolidaysPublicAdapter,
  schaffhauserlandAdapter,
  steinAmRheinAdapter,
  frauenfeldAdapter,
];

const THEME_SOURCE_ID = "kundivent-theme-days";

function toRow(event: NormalizedRadarEvent, syncedAt: string) {
  return {
    source_id: event.sourceId,
    external_id: event.externalId,
    source_key: event.sourceKey,
    source_url: event.sourceUrl,
    type: event.type,
    title: event.title,
    description: event.description,
    start_date: event.startDate,
    end_date: event.endDate,
    all_day: event.allDay,
    start_time: event.startTime,
    end_time: event.endTime,
    location_name: event.locationName,
    city: event.city,
    canton: event.canton,
    category: event.category,
    relevance: event.relevance,
    kundivent_idea: event.kundiventIdea,
    is_manual: false,
    active: true,
    last_synced_at: syncedAt,
  };
}

async function upsertEvents(events: NormalizedRadarEvent[]) {
  if (!events.length) return 0;
  const syncedAt = new Date().toISOString();
  // Chunked upsert on (source_id, source_key) — repeated syncs update in place.
  const chunkSize = 200;
  for (let i = 0; i < events.length; i += chunkSize) {
    const chunk = events.slice(i, i + chunkSize).map((e) => toRow(e, syncedAt));
    const { error } = await supabaseAdmin
      .from("radar_events")
      .upsert(chunk, { onConflict: "source_id,source_key" });
    if (error) throw new Error(error.message);
  }
  return events.length;
}

async function recordSourceStatus(
  sourceId: string,
  status: "success" | "failed",
  errorMessage: string | null,
  summary?: string | null,
) {
  const patch: Record<string, unknown> = {
    last_sync_at: new Date().toISOString(),
    last_sync_status: status,
    last_sync_error: errorMessage,
  };
  if (summary !== undefined) patch["last_sync_summary"] = summary;
  await supabaseAdmin.from("radar_sources").update(patch).eq("id", sourceId);
}

type ImportCounts = { created: number; updated: number; unchanged: number };

/** Compares incoming records with the stored ones to report real changes. */
async function classify(
  sourceId: string,
  events: NormalizedRadarEvent[],
): Promise<ImportCounts> {
  const counts: ImportCounts = { created: 0, updated: 0, unchanged: 0 };
  const { data } = await supabaseAdmin
    .from("radar_events")
    .select("source_key, title, description, start_date, end_date, start_time, end_time, location_name, category, active")
    .eq("source_id", sourceId);
  const existing = new Map((data ?? []).map((row) => [row.source_key, row]));
  for (const event of events) {
    const row = existing.get(event.sourceKey);
    if (!row) {
      counts.created += 1;
      continue;
    }
    const same =
      row.title === event.title &&
      (row.description ?? null) === (event.description ?? null) &&
      row.start_date === event.startDate &&
      (row.end_date ?? null) === (event.endDate ?? null) &&
      (row.start_time ?? null)?.slice(0, 5) === (event.startTime ?? null) &&
      (row.end_time ?? null)?.slice(0, 5) === (event.endTime ?? null) &&
      (row.location_name ?? null) === (event.locationName ?? null) &&
      (row.category ?? null) === (event.category ?? null) &&
      row.active === true;
    if (same) counts.unchanged += 1;
    else counts.updated += 1;
  }
  return counts;
}

/**
 * Conservative cleanup: only after a complete successful scan, and only for
 * future imported records of that source that were not returned this time.
 */
async function deactivateStale(sourceId: string, events: NormalizedRadarEvent[]) {
  const keep = new Set(events.map((e) => e.sourceKey));
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabaseAdmin
    .from("radar_events")
    .select("id, source_key")
    .eq("source_id", sourceId)
    .eq("is_manual", false)
    .eq("active", true)
    .gte("start_date", today);
  const stale = (data ?? []).filter((row) => !keep.has(row.source_key)).map((row) => row.id);
  if (!stale.length) return 0;
  await supabaseAdmin.from("radar_events").update({ active: false }).in("id", stale);
  return stale.length;
}

function summaryLine(
  stats: RadarSyncStats | null,
  counts: ImportCounts,
  deactivated: number,
): string {
  const parts = [
    stats ? `Gefunden: ${stats.discovered}` : null,
    `Neu: ${counts.created}`,
    `Aktualisiert: ${counts.updated}`,
    `Unverändert: ${counts.unchanged}`,
    stats && stats.skipped ? `Übersprungen: ${stats.skipped}` : null,
    stats && stats.errors ? `Fehler: ${stats.errors}` : null,
    deactivated ? `Deaktiviert: ${deactivated}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

/**
 * Curated theme days are materialized from `radar_theme_days` into
 * `radar_events` for every year of the sync horizon.
 */
export async function syncThemeDays(ctx: RadarSyncContext) {
  const { data, error } = await supabaseAdmin
    .from("radar_theme_days")
    .select("*")
    .eq("active", true);
  if (error) throw new Error(error.message);

  const fromYear = Number(ctx.fromDate.slice(0, 4));
  const toYear = Number(ctx.toDate.slice(0, 4));
  const events: NormalizedRadarEvent[] = [];

  for (const day of data ?? []) {
    for (let year = fromYear; year <= toYear; year += 1) {
      const date = `${year}-${String(day.month).padStart(2, "0")}-${String(day.day).padStart(2, "0")}`;
      events.push({
        sourceId: THEME_SOURCE_ID,
        externalId: day.id,
        sourceKey: `theme:${day.id}:${year}`,
        sourceUrl: day.source_url,
        type: "theme_day",
        title: day.name,
        description: day.description,
        startDate: date,
        endDate: date,
        allDay: true,
        startTime: null,
        endTime: null,
        locationName: null,
        city: null,
        canton: null,
        category: day.category,
        relevance: (day.relevance as NormalizedRadarEvent["relevance"]) ?? "medium",
        kundiventIdea: day.kundivent_idea,
      });
    }
  }

  const count = await upsertEvents(events);
  await recordSourceStatus(THEME_SOURCE_ID, "success", null);
  return count;
}

export type SourceSyncResult = {
  sourceId: string;
  status: "success" | "failed" | "skipped";
  count: number;
  error: string | null;
  summary?: string | null;
};

async function syncAdapter(
  adapter: RadarSourceAdapter,
  ctx: RadarSyncContext,
): Promise<SourceSyncResult> {
  if (!adapter.connected) {
    return { sourceId: adapter.sourceId, status: "skipped", count: 0, error: null };
  }
  try {
    const result = await adapter.fetchEvents(ctx);
    const events = Array.isArray(result) ? result : result.events;
    const stats = Array.isArray(result) ? null : (result.stats ?? null);

    const counts = await classify(adapter.sourceId, events);
    const count = await upsertEvents(events);
    const deactivated = adapter.supportsDeactivation
      ? await deactivateStale(adapter.sourceId, events)
      : 0;
    const summary = summaryLine(stats, counts, deactivated);
    await recordSourceStatus(adapter.sourceId, "success", null, summary);
    return { sourceId: adapter.sourceId, status: "success", count, error: null, summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Previously synchronized data stays untouched.
    await recordSourceStatus(adapter.sourceId, "failed", message);
    return { sourceId: adapter.sourceId, status: "failed", count: 0, error: message };
  }
}

/** Synchronizes every connected source plus the curated theme days. */
export async function runRadarSync(sourceId?: string): Promise<SourceSyncResult[]> {
  const ctx = syncHorizon();
  const results: SourceSyncResult[] = [];

  const adapters = sourceId
    ? RADAR_ADAPTERS.filter((a) => a.sourceId === sourceId)
    : RADAR_ADAPTERS;
  for (const adapter of adapters) results.push(await syncAdapter(adapter, ctx));

  if (!sourceId || sourceId === THEME_SOURCE_ID) {
    try {
      const count = await syncThemeDays(ctx);
      results.push({ sourceId: THEME_SOURCE_ID, status: "success", count, error: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await recordSourceStatus(THEME_SOURCE_ID, "failed", message);
      results.push({ sourceId: THEME_SOURCE_ID, status: "failed", count: 0, error: message });
    }
  }

  return results;
}
