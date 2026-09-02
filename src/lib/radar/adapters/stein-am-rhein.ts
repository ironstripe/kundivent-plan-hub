/**
 * Stadt Stein am Rhein — first live regional Radar source.
 *
 * Strategy (server-side only):
 *   1. discover event ids from the official event overview (paginated)
 *   2. fetch the official iCalendar representation per event
 *   3. parse it (incl. simple recurrences) and normalize into radar_events
 *
 * The whole website-specific knowledge lives in this file. If the
 * municipality later publishes a proper feed/API, only this adapter changes.
 */
import {
  expandRecurrence,
  first,
  parseIcsDate,
  parseIcsEvents,
  textValue,
  addDays,
} from "@/lib/radar/ics";
import type {
  NormalizedRadarEvent,
  RadarSourceAdapter,
  RadarSyncStats,
} from "@/lib/radar/types";

const SOURCE_ID = "stein-am-rhein";
const BASE_URL = "https://www.steinamrhein.ch";
const OVERVIEW_PATH = "/themen-az/veranstaltungen.html/21";
const ICS_PATH = "/route/core-iCalendar-generate/entityid";
const ENTITY_TYPE_ID = 297;
const MAX_PAGES = 8;
const REQUEST_TIMEOUT_MS = 20000;

const USER_AGENT =
  "Mozilla/5.0 (compatible; KundiventRadar/1.0; +https://kundivent-plan-hub.lovable.app)";

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        accept: "text/html,application/xhtml+xml,text/calendar,*/*",
        "accept-language": "de-CH,de;q=0.9",
        "user-agent": USER_AGENT,
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} für ${url}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

type Discovered = { eventId: string; detailUrl: string };

const EVENT_LINK = /veranstaltungen\.html\/\d+\/event\/(\d+)\/eventdate\/(\d+)/g;

/** Reads the public overview pages and collects the stable event ids. */
async function discover(): Promise<Discovered[]> {
  const found = new Map<string, Discovered>();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url =
      page === 1
        ? `${BASE_URL}${OVERVIEW_PATH}`
        : `${BASE_URL}${OVERVIEW_PATH}/eventsjsRequest/0/eventspage/${page}`;
    const html = await fetchText(url);
    const before = found.size;
    EVENT_LINK.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = EVENT_LINK.exec(html))) {
      const eventId = match[1]!;
      if (found.has(eventId)) continue;
      found.set(eventId, {
        eventId,
        detailUrl: `${BASE_URL}/themen-az/veranstaltungen.html/22/event/${eventId}/eventdate/${match[2]}`,
      });
    }
    // No new events on this page → pagination exhausted.
    if (found.size === before) break;
  }
  return [...found.values()];
}

/* ------------------------------------------------------------------ */
/* Normalization                                                       */
/* ------------------------------------------------------------------ */

const CATEGORY_MAP: Record<string, string> = {
  kino: "Kultur",
  "musik/konzerte": "Musik",
  musik: "Musik",
  konzerte: "Musik",
  "sport/freizeit": "Sport",
  sport: "Sport",
  theater: "Kultur",
  kultur: "Kultur",
  markt: "Markt",
  messe: "Messe",
  familie: "Familie",
  kulinarik: "Kulinarik",
  brauchtum: "Brauchtum",
  verschiedenes: "Sonstiges",
};

const KEYWORD_CATEGORIES: { pattern: RegExp; category: string }[] = [
  { pattern: /(markt|märt|flohmarkt|weihnachtsmarkt)/i, category: "Markt" },
  { pattern: /(messe|ausstellung)/i, category: "Messe" },
  { pattern: /(fasnacht|umzug|brauchtum|1\.\s*august|silvester)/i, category: "Brauchtum" },
  { pattern: /(konzert|musik|chor|jazz|blues|band)/i, category: "Musik" },
  { pattern: /(kulinar|degustation|metzgete|brunch|dinner|wein)/i, category: "Kulinarik" },
  { pattern: /(kinder|famili|spielgruppe|geschichten)/i, category: "Familie" },
  { pattern: /(lauf|turnier|sport|schwimm|velo)/i, category: "Sport" },
  { pattern: /(theater|kino|film|lesung|führung|ausstellung|kunst)/i, category: "Kultur" },
];

function mapCategory(icsCategories: string | null, title: string): string {
  if (icsCategories) {
    for (const raw of icsCategories.split(",")) {
      const mapped = CATEGORY_MAP[raw.trim().toLowerCase()];
      if (mapped && mapped !== "Sonstiges") return mapped;
    }
  }
  for (const { pattern, category } of KEYWORD_CATEGORIES) {
    if (pattern.test(title)) return category;
  }
  if (icsCategories && CATEGORY_MAP[icsCategories.trim().toLowerCase()]) {
    return CATEGORY_MAP[icsCategories.trim().toLowerCase()]!;
  }
  return "Sonstiges";
}

/** Deliberately conservative: only unmistakably large public events. */
const HIGH_RELEVANCE =
  /(stadtfest|dorffest|festival|fasnacht|weihnachtsmarkt|jahrmarkt|hafenfest|stein klingt|1\.\s*august|silvester)/i;

function mapRelevance(title: string): NormalizedRadarEvent["relevance"] {
  return HIGH_RELEVANCE.test(title) ? "high" : "medium";
}

function locationOf(raw: string | null): string | null {
  if (!raw) return null;
  return raw.replace(/\s*,\s*Stein am Rhein\s*$/i, "").trim() || null;
}

function truncate(value: string | null, max = 1200): string | null {
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/* ------------------------------------------------------------------ */
/* Adapter                                                             */
/* ------------------------------------------------------------------ */

function horizon() {
  const today = new Date().toISOString().slice(0, 10);
  const to = new Date();
  to.setUTCFullYear(to.getUTCFullYear() + 1);
  return { from: today, to: to.toISOString().slice(0, 10) };
}

export const steinAmRheinAdapter: RadarSourceAdapter = {
  sourceId: SOURCE_ID,
  label: "Stadt Stein am Rhein",
  connected: true,
  async fetchEvents() {
    const { from, to } = horizon();
    const stats: RadarSyncStats = { discovered: 0, parsed: 0, skipped: 0, errors: 0, messages: [] };

    // Discovery failure is fatal — a partial scan must never look like cancellations.
    const discovered = await discover();
    stats.discovered = discovered.length;
    if (!discovered.length) {
      throw new Error("Keine Veranstaltungen in der offiziellen Übersicht gefunden.");
    }

    const events: NormalizedRadarEvent[] = [];

    for (const item of discovered) {
      try {
        const ics = await fetchText(
          `${BASE_URL}${ICS_PATH}/${item.eventId}/entitytypeid/${ENTITY_TYPE_ID}`,
        );
        if (!ics.includes("BEGIN:VEVENT")) throw new Error("keine iCalendar-Daten");

        let produced = 0;
        for (const vevent of parseIcsEvents(ics)) {
          const dtstart = first(vevent, "DTSTART");
          const title = textValue(vevent, "SUMMARY");
          if (!dtstart || !title) {
            stats.skipped += 1;
            continue;
          }
          const start = parseIcsDate(dtstart.value);
          if (!start) {
            stats.skipped += 1;
            continue;
          }
          const dtend = first(vevent, "DTEND");
          const end = dtend ? parseIcsDate(dtend.value) : null;
          const allDay =
            dtstart.params["VALUE"] === "DATE" || (!start.time && !(end?.time ?? null));

          // Length of the occurrence; all-day DTEND is exclusive.
          const rawEndDate = end?.date ?? start.date;
          const endDate =
            allDay && end && end.date > start.date ? addDays(end.date, -1) : rawEndDate;
          const spanDays = Math.max(
            0,
            Math.round(
              (Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${start.date}T00:00:00Z`)) / 86400000,
            ),
          );

          const exdates = (vevent["EXDATE"] ?? [])
            .flatMap((prop) => prop.value.split(","))
            .map((value) => parseIcsDate(value)?.date)
            .filter((d): d is string => Boolean(d));

          const rrule = first(vevent, "RRULE")?.value ?? null;
          // Recurring events may start before the horizon; expand from the base date.
          const occurrences = expandRecurrence(start.date, rrule, exdates, from, to);
          // Keep long-running exhibitions that started before today but still run.
          if (!occurrences.length && !rrule) {
            const occEnd = endDate;
            if (start.date <= to && occEnd >= from) occurrences.push(start.date);
          }
          if (!occurrences.length) continue;

          const category = mapCategory(textValue(vevent, "CATEGORIES"), title);
          const location = locationOf(textValue(vevent, "LOCATION"));
          const description = truncate(textValue(vevent, "DESCRIPTION"));
          const uid = textValue(vevent, "UID");

          for (const occurrence of occurrences) {
            events.push({
              sourceId: SOURCE_ID,
              externalId: item.eventId,
              sourceKey: `sar:${item.eventId}:${occurrence}`,
              sourceUrl: item.detailUrl,
              type: "regional_event",
              title,
              description: description ?? (uid ? null : null),
              startDate: occurrence,
              endDate: spanDays > 0 ? addDays(occurrence, spanDays) : occurrence,
              allDay,
              startTime: allDay ? null : (start.time ?? null),
              endTime: allDay ? null : (end?.time ?? null),
              locationName: location,
              city: "Stein am Rhein",
              canton: "SH",
              category,
              relevance: mapRelevance(title),
              kundiventIdea: null,
            });
            produced += 1;
          }
        }
        if (produced === 0) stats.skipped += 1;
        else stats.parsed += 1;
      } catch (err) {
        // One broken event must never abort the whole synchronization.
        stats.errors += 1;
        if (stats.messages.length < 5) {
          stats.messages.push(
            `Event ${item.eventId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }

    if (!events.length) {
      throw new Error("Keine Veranstaltung konnte aus den iCalendar-Daten gelesen werden.");
    }

    return { events, stats };
  },
};
