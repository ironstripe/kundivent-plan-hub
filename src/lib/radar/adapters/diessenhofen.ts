/**
 * Stadtgemeinde Diessenhofen — official municipal event calendar.
 *
 * The site publishes no iCalendar export and no API. It does however emit the
 * events as hCalendar microformat markup (`vevent` / `dtstart` / `dtend` /
 * `summary` / `location`) with machine-readable ISO dates, and every event has
 * a stable numeric id in its permalink. Only that structured markup is read —
 * no layout-dependent scraping, no invented endpoints.
 *
 * Strategy (server-side only):
 *   1. read the official calendar overview plus its month pages
 *   2. take the machine-readable dtstart/dtend and the stable event id
 *   3. enrich each occurrence from the official detail page (time, location)
 *   4. normalize into radar_events
 */
import { classifyCategory, classifyRelevance } from "@/lib/radar/classify";
import type {
  NormalizedRadarEvent,
  RadarSourceAdapter,
  RadarSyncStats,
} from "@/lib/radar/types";

const SOURCE_ID = "diessenhofen";
const BASE_URL = "https://www.diessenhofen.ch";
const OVERVIEW_PATH = "/staedtlileben/veranstaltungen.html/100";
const MAX_DETAIL_REQUESTS = 80;
const REQUEST_TIMEOUT_MS = 20000;
/** The site rate-limits bursts with HTTP 429 — stay deliberately slow. */
const REQUEST_DELAY_MS = 1400;
const MAX_RETRIES = 3;

const USER_AGENT =
  "Mozilla/5.0 (compatible; KundiventRadar/1.0; +https://kundivent-plan-hub.lovable.app)";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchOnce(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml,*/*",
        "accept-language": "de-CH,de;q=0.9",
        "user-agent": USER_AGENT,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string): Promise<string> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    if (attempt > 0) await sleep(REQUEST_DELAY_MS * 2 * attempt);
    const response = await fetchOnce(url);
    if (response.ok) return await response.text();
    lastStatus = response.status;
    // Only throttling/temporary states are worth another attempt.
    if (response.status !== 429 && response.status !== 503) break;
  }
  throw new Error(`HTTP ${lastStatus} für ${url}`);
}

/* ------------------------------------------------------------------ */
/* Minimal HTML helpers                                                */
/* ------------------------------------------------------------------ */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  szlig: "ß",
  auml: "ä",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Ouml: "Ö",
  Uuml: "Ü",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  laquo: "«",
  raquo: "»",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

export function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (full, name: string) => ENTITIES[name] ?? full);
}

export function stripTags(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(value: string | null, max = 1200): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** Reads the ISO date out of an hCalendar `<time datetime="...">` value. */
export function isoDateOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = /(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match ? match[1]! : null;
}

function timeOf(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = /(\d{1,2})[:.](\d{2})/.exec(raw);
  if (!match) return null;
  return `${match[1]!.padStart(2, "0")}:${match[2]}`;
}

/* ------------------------------------------------------------------ */
/* Discovery — hCalendar list entries                                  */
/* ------------------------------------------------------------------ */

export type DiessenhofenEntry = {
  eventId: string;
  eventDateId: string;
  detailUrl: string;
  startDate: string;
  endDate: string;
  title: string;
  description: string | null;
};

const LIST_ITEM = /<li[^>]*class="[^"]*\bvevent\b[^"]*"[^>]*>([\s\S]*?)<\/li>/g;

const TIME_TAG = /<time[^>]*datetime="([^"]*)"[^>]*class="[^"]*\b(dtstart|dtend)\b[^"]*"[^>]*>/g;
const EVENT_LINK = /href="([^"]*\/event\/(\d+)\/eventdate\/(\d+))"/;
const TITLE_BLOCK = /class="[^"]*\bsummary\b[^"]*"[^>]*>([\s\S]*?)<\/(?:h1|h2|h3)>/;
const DESC_BLOCK = /class="[^"]*\bdescription\b[^"]*"[^>]*>([\s\S]*?)<\/p>/;

/** Parses the machine-readable hCalendar entries of one calendar page. */
export function parseListPage(html: string): DiessenhofenEntry[] {
  const entries: DiessenhofenEntry[] = [];
  LIST_ITEM.lastIndex = 0;
  let item: RegExpExecArray | null;
  while ((item = LIST_ITEM.exec(html))) {
    const block = item[1]!;
    const link = EVENT_LINK.exec(block);
    if (!link) continue;

    let startDate: string | null = null;
    let endDate: string | null = null;
    TIME_TAG.lastIndex = 0;
    let time: RegExpExecArray | null;
    while ((time = TIME_TAG.exec(block))) {
      const date = isoDateOf(time[1]);
      if (!date) continue;
      if (time[2] === "dtstart") startDate ??= date;
      else endDate = date;
    }
    if (!startDate) continue;

    const title = stripTags(TITLE_BLOCK.exec(block)?.[1] ?? "");
    if (!title) continue;
    const description = stripTags(DESC_BLOCK.exec(block)?.[1] ?? "") || null;

    entries.push({
      eventId: link[2]!,
      eventDateId: link[3]!,
      detailUrl: decodeEntities(link[1]!),
      startDate,
      endDate: endDate && endDate > startDate ? endDate : startDate,
      title,
      description,
    });
  }
  return entries;
}

/* ------------------------------------------------------------------ */
/* Detail page — official times and location                           */
/* ------------------------------------------------------------------ */

export type DiessenhofenDetail = {
  startTime: string | null;
  endTime: string | null;
  locationName: string | null;
  description: string | null;
};

const DETAIL_BLOCK = /<div[^>]*class="[^"]*\bmod-event-detail\b[^"]*"[^>]*>([\s\S]*?)<\/main>/;
const FROM_BLOCK = /class="[^"]*\bevent-time-from\b[^"]*"[^>]*>([\s\S]*?)<\/span>/;
const TO_BLOCK = /class="[^"]*\bevent-time-to\b[^"]*"[^>]*>([\s\S]*?)<\/span>/;
const LOCATION_BLOCK = /class="[^"]*\blocation\b[^"]*"[^>]*>([\s\S]*?)<\/p>/;

export function parseDetailPage(html: string): DiessenhofenDetail {
  const block = DETAIL_BLOCK.exec(html)?.[1] ?? html;
  // Times are printed as plain text next to the machine-readable date.
  const fromText = stripTags((FROM_BLOCK.exec(block)?.[1] ?? "").replace(/<time[\s\S]*?<\/time>/g, " "));
  const toText = stripTags((TO_BLOCK.exec(block)?.[1] ?? "").replace(/<time[\s\S]*?<\/time>/g, " "));
  const location =
    stripTags(LOCATION_BLOCK.exec(block)?.[1] ?? "")
      .replace(/^Veranstaltungsort\s*:?\s*/i, "")
      .replace(/\s*Lageplan\s*$/i, "")
      .trim() || null;
  const description = stripTags(DESC_BLOCK.exec(block)?.[1] ?? "") || null;
  return {
    startTime: timeOf(fromText),
    endTime: timeOf(toText),
    locationName: location,
    description,
  };
}

/* ------------------------------------------------------------------ */
/* Adapter                                                             */
/* ------------------------------------------------------------------ */

/**
 * The official overview already lists every upcoming occurrence (well beyond
 * a year), so one request is enough — extra month pages only trigger the
 * site's rate limiting.
 */
function listUrls(): string[] {
  return [`${BASE_URL}${OVERVIEW_PATH}`];
}

export const diessenhofenAdapter: RadarSourceAdapter = {
  sourceId: SOURCE_ID,
  label: "Stadtgemeinde Diessenhofen",
  connected: true,
  supportsDeactivation: true,
  async fetchEvents() {
    const stats: RadarSyncStats = { discovered: 0, parsed: 0, skipped: 0, errors: 0, messages: [] };
    const entries = new Map<string, DiessenhofenEntry>();
    let pagesRead = 0;

    for (const url of listUrls()) {
      try {
        const html = await fetchText(url);
        pagesRead += 1;
        for (const entry of parseListPage(html)) {
          entries.set(`${entry.eventId}:${entry.startDate}`, entry);
        }
      } catch (err) {
        stats.errors += 1;
        if (stats.messages.length < 5) {
          stats.messages.push(`Kalenderseite: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    // A partial scan must never look like a wave of cancellations.
    if (!pagesRead) throw new Error("Der offizielle Veranstaltungskalender ist nicht erreichbar.");
    stats.discovered = entries.size;
    if (!entries.size) {
      throw new Error("Keine Veranstaltungen im offiziellen Kalender gefunden.");
    }

    const events: NormalizedRadarEvent[] = [];
    const detailCache = new Map<string, DiessenhofenDetail>();
    let detailRequests = 0;

    for (const entry of entries.values()) {
      let detail: DiessenhofenDetail | null = detailCache.get(entry.detailUrl) ?? null;
      if (!detail && detailRequests < MAX_DETAIL_REQUESTS) {
        try {
          if (detailRequests > 0) await sleep(REQUEST_DELAY_MS);
          detailRequests += 1;
          detail = parseDetailPage(await fetchText(entry.detailUrl));
          detailCache.set(entry.detailUrl, detail);
        } catch (err) {
          // The list entry alone is still a valid Radar record.
          stats.errors += 1;
          if (stats.messages.length < 5) {
            stats.messages.push(
              `Event ${entry.eventId}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }
      }

      const description = truncate(detail?.description ?? entry.description);
      const allDay = !detail?.startTime;

      events.push({
        sourceId: SOURCE_ID,
        externalId: entry.eventId,
        sourceKey: `dhf:${entry.eventId}:${entry.startDate}`,
        sourceUrl: entry.detailUrl,
        type: "regional_event",
        title: entry.title,
        description,
        startDate: entry.startDate,
        endDate: entry.endDate,
        allDay,
        startTime: allDay ? null : detail!.startTime,
        endTime: allDay ? null : (detail?.endTime ?? null),
        locationName: detail?.locationName ?? null,
        city: "Diessenhofen",
        canton: "TG",
        category: classifyCategory(entry.title, description),
        relevance: classifyRelevance(entry.title),
        kundiventIdea: null,
      });
      stats.parsed += 1;
    }

    return { events, stats };
  },
};
