/**
 * Shared Radar types.
 *
 * Radar is a planning-context layer: it never writes into the operational
 * Kundivent event tables and external data is always normalized into
 * `radar_events` before it reaches the UI.
 */

export const RADAR_TYPES = [
  "school_holiday",
  "public_holiday",
  "regional_event",
  "theme_day",
] as const;

export type RadarType = (typeof RADAR_TYPES)[number];

export type RadarRelevance = "high" | "medium" | "low";

export const RELEVANCE_LABEL: Record<RadarRelevance, string> = {
  high: "Hoch",
  medium: "Mittel",
  low: "Gering",
};

export const RADAR_TYPE_LABEL: Record<RadarType, string> = {
  school_holiday: "Schulferien",
  public_holiday: "Feiertag",
  regional_event: "Regionales Event",
  theme_day: "Thementag",
};

/** Normalized regional-event categories (Phase 1 — no perfect classification). */
export const REGIONAL_CATEGORIES = [
  "Kultur",
  "Musik",
  "Markt",
  "Messe",
  "Sport",
  "Familie",
  "Kulinarik",
  "Brauchtum",
  "Sonstiges",
] as const;

export type RegionalCategory = (typeof REGIONAL_CATEGORIES)[number];

export const THEME_CATEGORIES = [
  "Fisch & Genuss",
  "Natur & Umwelt",
  "Familie & Freizeit",
] as const;

export type ThemeCategory = (typeof THEME_CATEGORIES)[number];

/** Cantons covered by the holiday layers. */
export const RADAR_CANTONS = ["CH", "SH", "TG", "ZH"] as const;
export type RadarCanton = (typeof RADAR_CANTONS)[number];

/** Cities covered by the regional-event layer. */
export const RADAR_CITIES = [
  "Schaffhausen",
  "Stein am Rhein",
  "Diessenhofen",
  "Frauenfeld",
] as const;

/**
 * A Radar record after normalization — the only shape adapters may return.
 * `sourceKey` must be stable across syncs so imports stay idempotent.
 */
export type NormalizedRadarEvent = {
  sourceId: string;
  externalId: string | null;
  sourceKey: string;
  sourceUrl: string | null;
  type: RadarType;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  locationName: string | null;
  city: string | null;
  canton: string | null;
  category: string | null;
  relevance: RadarRelevance;
  kundiventIdea: string | null;
};

export type RadarSyncContext = {
  /** Inclusive sync horizon (current year + next two years). */
  fromDate: string;
  toDate: string;
};

/**
 * Every external source is connected through this interface so the Radar UI
 * and data model stay independent of any provider.
 */
/** Optional per-source diagnostics shown to admins in the Radar settings. */
export type RadarSyncStats = {
  discovered: number;
  parsed: number;
  skipped: number;
  errors: number;
  messages: string[];
};

export type RadarAdapterResult =
  | NormalizedRadarEvent[]
  | { events: NormalizedRadarEvent[]; stats?: RadarSyncStats };

export type RadarSourceAdapter = {
  sourceId: string;
  label: string;
  /** false = registry entry prepared, no usable structured interface yet. */
  connected: boolean;
  /** true = stale future records may be deactivated after a complete scan. */
  supportsDeactivation?: boolean;
  fetchEvents(context: RadarSyncContext): Promise<RadarAdapterResult>;
};

/** Sync horizon: current year plus the next two years. */
export function syncHorizon(today = new Date()): RadarSyncContext {
  const year = today.getUTCFullYear();
  return { fromDate: `${year}-01-01`, toDate: `${year + 2}-12-31` };
}
