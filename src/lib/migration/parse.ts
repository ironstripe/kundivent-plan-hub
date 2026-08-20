import * as XLSX from "xlsx";
import type { EventStatus } from "@/lib/events";

export const MIGRATION_SOURCE = "kundelfingerhof_excel";

/** Excel planning column -> Kundivent planning area name (null = no automatic mapping). */
export const COLUMN_AREA_MAP: Record<string, string | null> = {
  "Kundelfingerhof AG": null,
  Hofladen: "Hofladen",
  "KFH-Fishing": "KFH-Fishing",
  "Restaurant à la Carte": "Restaurant / À la Carte",
  "Bankett/Event": "Event / Pavillon",
  Hofstube: "Hofstube",
};

export const PLANNING_COLUMNS = Object.keys(COLUMN_AREA_MAP);
export const UMBRELLA_COLUMN = "Kundelfingerhof AG";
export const ANNUAL_SHEETS = ["2026", "2027", "2028"];
export const WEEKEND_SHEET = "Wochenend-Übersicht";

export type SkippedCell = {
  sheet: string;
  row: number;
  date: string | null;
  column: string;
  text: string;
  reason: string;
};

export type MigrationRecord = {
  /** Stable source reference, written to events.migration_source_ref. */
  ref: string;
  sheet: string;
  rows: number[];
  sourceColumns: string[];
  originalText: string;
  title: string;
  startDate: string;
  endDate: string | null;
  areaNames: string[];
  categoryName: string;
  status: EventStatus;
  pax: number | null;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  notes: string;
  reviewRequired: boolean;
  reviewReasons: string[];
  sourceCellCount: number;
  consolidatedDays: boolean;
  mergedAreas: boolean;
};

export type WeekendMismatch = {
  date: string;
  weekday: string;
  sheetStatus: string;
  derivedStatus: string;
};

export type ParseResult = {
  records: MigrationRecord[];
  skipped: SkippedCell[];
  sheetsProcessed: string[];
  sourceCells: number;
  weekendChecked: number;
  weekendMismatches: WeekendMismatch[];
};

type Cell = {
  sheet: string;
  row: number;
  date: string;
  column: string;
  raw: string;
};

function toIsoDate(value: unknown): string | null {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
  }
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
  }
  return null;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function cleanText(raw: string): string {
  return raw
    .replace(/\s*\n\s*/g, ", ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKey(text: string): string {
  return cleanText(text).toLowerCase().replace(/[\s.,()-]+/g, " ").trim();
}

const PAX_PATTERN =
  /[\s-–]*(?:(\d{1,4})\s*[-–]\s*(\d{1,4})|(\d{1,4})|\?)\s*(pax|pers\.?|personen)\b/i;
const PAX_PREFIX_PATTERN = /[\s-–]*(?:pax)\s*(\d{1,4})\b/i;

type PaxResult = { pax: number | null; title: string; reason: string | null };

function extractPax(text: string): PaxResult {
  const suffix = text.match(PAX_PATTERN);
  if (suffix) {
    const stripped = cleanText(text.replace(suffix[0], " ")).replace(/[-–,]\s*$/, "").trim();
    if (suffix[1] && suffix[2]) {
      return {
        pax: null,
        title: stripped || cleanText(text),
        reason: `Personenzahl als Bereich angegeben (${suffix[1]}–${suffix[2]}) – bitte prüfen`,
      };
    }
    if (suffix[3]) {
      return { pax: Number(suffix[3]), title: stripped || cleanText(text), reason: null };
    }
    return {
      pax: null,
      title: stripped || cleanText(text),
      reason: "Personenzahl im Quelltext unbekannt (?)",
    };
  }
  const prefix = text.match(PAX_PREFIX_PATTERN);
  if (prefix) {
    const stripped = cleanText(text.replace(prefix[0], " ")).replace(/[-–,]\s*$/, "").trim();
    return { pax: Number(prefix[1]), title: stripped || cleanText(text), reason: null };
  }
  return { pax: null, title: cleanText(text), reason: null };
}

const CATEGORY_RULES: { category: string; patterns: RegExp[] }[] = [
  { category: "Betriebsferien", patterns: [/\bbetriebsferien\b/i, /\bferien\b/i] },
  {
    category: "Hochzeit / Bankett",
    patterns: [/hochzeit/i, /bankett/i, /aufbautag/i, /apero/i, /apéro/i],
  },
  { category: "Kurs", patterns: [/\bkurs\b/i, /sana/i, /schulung/i, /fliegenfischerkurs/i] },
  {
    category: "Messe / externer Auftritt",
    patterns: [/messe/i, /ausstellung/i, /schlaraffia/i],
  },
  {
    category: "Gastroaktion",
    patterns: [
      /wochen\b/i,
      /brunch/i,
      /dinner/i,
      /degustation/i,
      /buffet/i,
      /metzgete/i,
      /metztgete/i,
      /tavolata/i,
      /beer\s*&\s*dine/i,
      /first friday/i,
    ],
  },
  {
    category: "Promotion / Verkauf",
    patterns: [/verkauf/i, /markt/i, /eröffnung/i, /angelshop/i],
  },
  {
    category: "Interner Anlass",
    patterns: [/personalanlass/i, /zukunftstag/i, /weihnachtsessen kundelfingerhof/i, /\bgv\b/i],
  },
];

function inferCategory(title: string): { category: string; confident: boolean } {
  for (const rule of CATEGORY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(title))) {
      return { category: rule.category, confident: true };
    }
  }
  if (/weihnachtsessen|wheinachtsessen|geburtstag|firmenessen/i.test(title)) {
    return { category: "Hochzeit / Bankett", confident: true };
  }
  if (/angeln|fischverkauf|fisch/i.test(title)) {
    return { category: "Eigenveranstaltung", confident: true };
  }
  return { category: "Sonstiges", confident: false };
}

function inferStatus(text: string): { status: EventStatus; reason: string | null } {
  if (/\babgesagt\b|\bstorniert\b|\bcancelled\b/i.test(text))
    return { status: "cancelled", reason: null };
  if (/provisorisch|\bprov\.?\b|\boption\b|angefragt|geplant/i.test(text))
    return { status: "provisional", reason: null };
  return { status: "confirmed", reason: null };
}

const HOLIDAY_AREAS = ["Restaurant / À la Carte", "Event / Pavillon", "Hofstube"];

function slug(text: string): string {
  return normalizeKey(text).replace(/\s+/g, "-").slice(0, 60);
}

type Segment = {
  sheet: string;
  column: string;
  titleKey: string;
  rawText: string;
  start: string;
  end: string;
  rows: number[];
  dates: string[];
};

function buildSegments(cells: Cell[]): Segment[] {
  const groups = new Map<string, Cell[]>();
  for (const cell of cells) {
    const key = `${cell.sheet}|${cell.column}|${normalizeKey(cell.raw)}`;
    const list = groups.get(key);
    if (list) list.push(cell);
    else groups.set(key, [cell]);
  }

  const segments: Segment[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    let current: Cell[] = [];
    const flush = () => {
      if (!current.length) return;
      const first = current[0]!;
      segments.push({
        sheet: first.sheet,
        column: first.column,
        titleKey: normalizeKey(first.raw),
        rawText: first.raw,
        start: first.date,
        end: current[current.length - 1]!.date,
        rows: current.map((c) => c.row),
        dates: current.map((c) => c.date),
      });
      current = [];
    };
    for (const cell of sorted) {
      if (!current.length) {
        current = [cell];
        continue;
      }
      const previous = current[current.length - 1]!;
      if (addDays(previous.date, 1) === cell.date) current.push(cell);
      else {
        flush();
        current = [cell];
      }
    }
    flush();
  }
  return segments;
}

function buildRecord(group: Segment[]): MigrationRecord {
  const primary = group[0]!;
  const columns = group.map((segment) => segment.column);
  const reviewReasons: string[] = [];

  const mappedAreas = [
    ...new Set(
      columns
        .map((column) => COLUMN_AREA_MAP[column])
        .filter((area): area is string => Boolean(area)),
    ),
  ];
  const hasUmbrella = columns.includes(UMBRELLA_COLUMN);

  const originalText = cleanText(primary.rawText);
  const pax = extractPax(originalText);
  let title = pax.title;
  if (pax.reason) reviewReasons.push(pax.reason);

  const category = inferCategory(originalText);
  if (!category.confident) reviewReasons.push("Kategorie konnte nicht sicher bestimmt werden");

  const status = inferStatus(originalText);
  if (status.reason) reviewReasons.push(status.reason);

  let areaNames = mappedAreas;
  let categoryName = category.category;
  let eventStatus = status.status;

  if (categoryName === "Betriebsferien") {
    areaNames = areaNames.filter((area) => HOLIDAY_AREAS.includes(area));
    eventStatus = "confirmed";
    if (title.toLowerCase() === "ferien") title = "Betriebsferien";
    if (!areaNames.length && !hasUmbrella)
      reviewReasons.push("Betriebsferien ohne gültigen Gastro-Planungsbereich");
  }

  if (hasUmbrella) {
    reviewReasons.push(
      mappedAreas.length
        ? "Quelle enthält Spalte «Kundelfingerhof AG» – Bereichszuordnung prüfen"
        : "Quelle «Kundelfingerhof AG» – Planungsbereich manuell zuweisen",
    );
  }

  if (/\?/.test(originalText)) reviewReasons.push("Quelltext enthält Unsicherheitsmarker «?»");
  if (!areaNames.length && !reviewReasons.length)
    reviewReasons.push("Kein Planungsbereich zugeordnet");

  const dayCount = group[0]!.dates.length;
  const ref = `${primary.sheet}|${[...columns].sort().join("+")}|${primary.start}|${primary.end}|${slug(originalText)}`;

  const notesParts = [`Excel-Quelle: ${primary.sheet}, Spalte(n) ${columns.join(", ")}`];
  if (originalText !== title) notesParts.push(`Originaltext: ${originalText}`);

  return {
    ref,
    sheet: primary.sheet,
    rows: [...new Set(group.flatMap((segment) => segment.rows))].sort((a, b) => a - b),
    sourceColumns: columns,
    originalText,
    title,
    startDate: primary.start,
    endDate: primary.end === primary.start ? null : primary.end,
    areaNames,
    categoryName,
    status: eventStatus,
    pax: pax.pax,
    allDay: true,
    startTime: null,
    endTime: null,
    notes: notesParts.join(" · "),
    reviewRequired: reviewReasons.length > 0 || areaNames.length === 0,
    reviewReasons,
    sourceCellCount: group.reduce((sum, segment) => sum + segment.dates.length, 0),
    consolidatedDays: dayCount > 1,
    mergedAreas: group.length > 1,
  };
}

function parseAnnualSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  skipped: SkippedCell[],
): { cells: Cell[]; sourceCells: number } {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { cells: [], sourceCells: 0 };
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    cellDates: true,
    blankrows: true,
  });

  const headerIndex = rows.findIndex((row) =>
    (row ?? []).some((cell) => typeof cell === "string" && cell.trim() === "Feiertage"),
  );
  if (headerIndex === -1) return { cells: [], sourceCells: 0 };

  const header = rows[headerIndex] ?? [];
  const columnIndex = new Map<number, string>();
  header.forEach((value, index) => {
    const name = typeof value === "string" ? value.trim() : "";
    if (PLANNING_COLUMNS.includes(name)) columnIndex.set(index, name);
  });

  const cells: Cell[] = [];
  let sourceCells = 0;

  for (let i = headerIndex + 1; i < rows.length; i += 1) {
    const row = rows[i] ?? [];
    const rowNumber = i + 1;
    const date = toIsoDate(row[0]);

    for (const [index, column] of columnIndex) {
      const value = row[index];
      const text = typeof value === "string" ? value : value == null ? "" : String(value);
      if (!text.trim()) continue;
      sourceCells += 1;

      if (!date) {
        skipped.push({
          sheet: sheetName,
          row: rowNumber,
          date: null,
          column,
          text: cleanText(text),
          reason: "Zeile ohne gültiges Datum",
        });
        continue;
      }
      if (date.slice(0, 4) !== sheetName) {
        skipped.push({
          sheet: sheetName,
          row: rowNumber,
          date,
          column,
          text: cleanText(text),
          reason: `Datum liegt ausserhalb des Blattjahres ${sheetName} – im Blatt ${date.slice(0, 4)} erfasst`,
        });
        continue;
      }
      cells.push({ sheet: sheetName, row: rowNumber, date, column, raw: text });
    }
  }

  return { cells, sourceCells };
}

function checkWeekendSheet(
  workbook: XLSX.WorkBook,
  records: MigrationRecord[],
): { checked: number; mismatches: WeekendMismatch[] } {
  const sheet = workbook.Sheets[WEEKEND_SHEET];
  if (!sheet) return { checked: 0, mismatches: [] };
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    cellDates: true,
    blankrows: true,
  });

  const occupied = new Set<string>();
  for (const record of records) {
    const relevant = record.sourceColumns.some(
      (column) => column === "Restaurant à la Carte" || column === "Bankett/Event",
    );
    if (!relevant) continue;
    let cursor = record.startDate;
    const end = record.endDate ?? record.startDate;
    while (cursor <= end) {
      occupied.add(cursor);
      cursor = addDays(cursor, 1);
    }
  }

  const groups: { dateIndex: number; statusIndex: number; label: string }[] = [
    { dateIndex: 1, statusIndex: 4, label: "Freitag" },
    { dateIndex: 5, statusIndex: 8, label: "Samstag" },
    { dateIndex: 9, statusIndex: 12, label: "Sonntag" },
  ];

  let checked = 0;
  const mismatches: WeekendMismatch[] = [];

  for (const row of rows) {
    if (!row) continue;
    for (const group of groups) {
      const date = toIsoDate(row[group.dateIndex]);
      const statusValue = row[group.statusIndex];
      const sheetStatus = typeof statusValue === "string" ? statusValue.trim() : "";
      if (!date || (sheetStatus !== "Frei" && sheetStatus !== "Belegt")) continue;
      checked += 1;
      const derived = occupied.has(date) ? "Belegt" : "Frei";
      if (derived !== sheetStatus) {
        mismatches.push({
          date,
          weekday: group.label,
          sheetStatus,
          derivedStatus: derived,
        });
      }
    }
  }

  return { checked, mismatches };
}

export function parseWorkbook(data: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(data, { cellDates: true });
  const skipped: SkippedCell[] = [];
  const cells: Cell[] = [];
  const sheetsProcessed: string[] = [];
  let sourceCells = 0;

  for (const sheetName of ANNUAL_SHEETS) {
    if (!workbook.SheetNames.includes(sheetName)) continue;
    sheetsProcessed.push(sheetName);
    const result = parseAnnualSheet(workbook, sheetName, skipped);
    cells.push(...result.cells);
    sourceCells += result.sourceCells;
  }

  const segments = buildSegments(cells);

  // Multi-area merge: identical title AND identical date range across planning columns.
  const merged = new Map<string, Segment[]>();
  for (const segment of segments) {
    const key = `${segment.sheet}|${segment.titleKey}|${segment.start}|${segment.end}`;
    const list = merged.get(key);
    if (list) list.push(segment);
    else merged.set(key, [segment]);
  }

  const records = [...merged.values()].map(buildRecord);

  // Ambiguous overlap: same title, different but overlapping ranges in different columns.
  for (const record of records) {
    const overlapping = records.filter(
      (other) =>
        other !== record &&
        normalizeKey(other.originalText) === normalizeKey(record.originalText) &&
        (other.endDate ?? other.startDate) >= record.startDate &&
        other.startDate <= (record.endDate ?? record.startDate) &&
        other.sourceColumns.join() !== record.sourceColumns.join(),
    );
    if (overlapping.length && !record.reviewReasons.some((r) => r.includes("Mehrbereichs"))) {
      record.reviewReasons.push(
        "Mögliche Mehrbereichs-Zuordnung mit überlappendem Eintrag – bitte prüfen",
      );
      record.reviewRequired = true;
    }
  }

  records.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title));

  const weekend = checkWeekendSheet(workbook, records);

  return {
    records,
    skipped,
    sheetsProcessed,
    sourceCells,
    weekendChecked: weekend.checked,
    weekendMismatches: weekend.mismatches,
  };
}
