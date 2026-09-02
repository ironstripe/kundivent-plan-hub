/**
 * OpenHolidays adapter — https://www.openholidaysapi.org/
 *
 * Provides Swiss school holidays and public holidays for SH, TG and ZH.
 * Nationwide public holidays are stored once with canton "CH".
 */
import type {
  NormalizedRadarEvent,
  RadarSourceAdapter,
  RadarSyncContext,
} from "@/lib/radar/types";

const BASE_URL = "https://openholidaysapi.org";

/** Subdivision codes according to the API. */
const SUBDIVISIONS: { canton: "SH" | "TG" | "ZH"; code: string }[] = [
  { canton: "SH", code: "CH-SH" },
  { canton: "TG", code: "CH-TG" },
  { canton: "ZH", code: "CH-ZH" },
];

type ApiHoliday = {
  id: string;
  startDate: string;
  endDate: string;
  name: { language: string; text: string }[];
  nationwide?: boolean;
  comment?: { language: string; text: string }[];
};

function pickText(entries: { language: string; text: string }[] | undefined) {
  if (!entries?.length) return null;
  return (entries.find((e) => e.language === "DE") ?? entries[0])?.text ?? null;
}

async function fetchList(
  path: "SchoolHolidays" | "PublicHolidays",
  subdivision: string,
  ctx: RadarSyncContext,
): Promise<ApiHoliday[]> {
  const url =
    `${BASE_URL}/${path}?countryIsoCode=CH&subdivisionCode=${subdivision}` +
    `&validFrom=${ctx.fromDate}&validTo=${ctx.toDate}&languageIsoCode=DE`;
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) {
    throw new Error(`OpenHolidays ${path} ${subdivision}: HTTP ${response.status}`);
  }
  return (await response.json()) as ApiHoliday[];
}

export const openHolidaysSchoolAdapter: RadarSourceAdapter = {
  sourceId: "openholidays-school",
  label: "OpenHolidays – Schulferien",
  connected: true,
  async fetchEvents(ctx) {
    const out = new Map<string, NormalizedRadarEvent>();
    for (const { canton, code } of SUBDIVISIONS) {
      const items = await fetchList("SchoolHolidays", code, ctx);
      for (const item of items) {
        const name = pickText(item.name) ?? "Schulferien";
        const sourceKey = `school:${canton}:${item.id}:${item.startDate}`;
        out.set(sourceKey, {
          sourceId: "openholidays-school",
          externalId: item.id,
          sourceKey,
          sourceUrl: "https://www.openholidaysapi.org/",
          type: "school_holiday",
          title: `${name} ${canton}`,
          description: pickText(item.comment),
          startDate: item.startDate,
          endDate: item.endDate,
          allDay: true,
          startTime: null,
          endTime: null,
          locationName: null,
          city: null,
          canton,
          category: null,
          relevance: "medium",
          kundiventIdea: null,
        });
      }
    }
    return [...out.values()];
  },
};

export const openHolidaysPublicAdapter: RadarSourceAdapter = {
  sourceId: "openholidays-public",
  label: "OpenHolidays – Feiertage",
  connected: true,
  async fetchEvents(ctx) {
    // A single map keyed by sourceKey deduplicates nationwide holidays that
    // are returned by every cantonal query.
    const out = new Map<string, NormalizedRadarEvent>();
    for (const { canton, code } of SUBDIVISIONS) {
      const items = await fetchList("PublicHolidays", code, ctx);
      for (const item of items) {
        const scope = item.nationwide ? "CH" : canton;
        const sourceKey = `public:${scope}:${item.id}:${item.startDate}`;
        if (out.has(sourceKey)) continue;
        out.set(sourceKey, {
          sourceId: "openholidays-public",
          externalId: item.id,
          sourceKey,
          sourceUrl: "https://www.openholidaysapi.org/",
          type: "public_holiday",
          title: pickText(item.name) ?? "Feiertag",
          description: pickText(item.comment),
          startDate: item.startDate,
          endDate: item.endDate,
          allDay: true,
          startTime: null,
          endTime: null,
          locationName: null,
          city: null,
          canton: scope,
          category: null,
          relevance: "medium",
          kundiventIdea: null,
        });
      }
    }
    return [...out.values()];
  },
};
