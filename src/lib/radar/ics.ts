/**
 * Minimal iCalendar reader used by Radar source adapters.
 *
 * Deliberately small: it understands the subset of RFC 5545 that municipal
 * calendars emit (VEVENT with DTSTART/DTEND/RRULE/EXDATE) and nothing more.
 */

export type IcsProp = {
  name: string;
  params: Record<string, string>;
  value: string;
};

export type IcsEvent = Record<string, IcsProp[]>;

/** Unfolds RFC 5545 line continuations. */
function unfold(text: string): string[] {
  const raw = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const lines: string[] = [];
  for (const line of raw) {
    if (/^[ \t]/.test(line) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

export function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function parseLine(line: string): IcsProp | null {
  const idx = line.indexOf(":");
  if (idx < 0) return null;
  const head = line.slice(0, idx);
  const value = line.slice(idx + 1);
  const [name, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: (name ?? "").toUpperCase(), params, value };
}

/** All VEVENT blocks of a calendar, each as a property map. */
export function parseIcsEvents(text: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let current: IcsEvent | null = null;
  for (const line of unfold(text)) {
    const trimmed = line.trim();
    if (trimmed === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (trimmed === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const prop = parseLine(line);
    if (!prop) continue;
    (current[prop.name] ??= []).push(prop);
  }
  return events;
}

export function first(event: IcsEvent, name: string): IcsProp | undefined {
  return event[name]?.[0];
}

export function textValue(event: IcsEvent, name: string): string | null {
  const prop = first(event, name);
  if (!prop) return null;
  const value = unescapeText(prop.value);
  return value.length ? value : null;
}

export type IcsDateTime = {
  /** yyyy-mm-dd in Europe/Zurich */
  date: string;
  /** HH:MM in Europe/Zurich, null for date-only values */
  time: string | null;
};

const zurichFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Zurich",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function utcToZurich(iso: string): IcsDateTime | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const parts = zurichFormatter.formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${hour}:${get("minute")}` };
}

/**
 * Parses a DTSTART/DTEND/EXDATE value. Floating and TZID values are treated as
 * local Swiss time, UTC values are converted to Europe/Zurich.
 */
export function parseIcsDate(value: string): IcsDateTime | null {
  const v = value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (dateOnly) return { date: `${dateOnly[1]}-${dateOnly[2]}-${dateOnly[3]}`, time: null };
  const dateTime = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(v);
  if (!dateTime) return null;
  const [, y, m, d, hh, mm, , z] = dateTime;
  if (z === "Z") return utcToZurich(`${y}-${m}-${d}T${hh}:${mm}:00Z`);
  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}

/* ------------------------------------------------------------------ */
/* Recurrence                                                          */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const base = new Date(Date.UTC(y!, (m ?? 1) - 1 + months, 1));
  const lastDay = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(d ?? 1, lastDay));
  return base.toISOString().slice(0, 10);
}

function weekday(date: string): string {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
}

/**
 * Expands an RRULE into concrete start dates inside [from, to].
 * Supports the common FREQ/INTERVAL/BYDAY/COUNT/UNTIL combinations; anything
 * exotic falls back to the single base occurrence.
 */
export function expandRecurrence(
  startDate: string,
  rrule: string | null,
  exdates: string[],
  from: string,
  to: string,
  limit = 400,
): string[] {
  const excluded = new Set(exdates);
  const keep = (date: string) => date >= from && date <= to && !excluded.has(date);
  if (!rrule) return keep(startDate) ? [startDate] : [];

  const parts: Record<string, string> = {};
  for (const chunk of rrule.split(";")) {
    const eq = chunk.indexOf("=");
    if (eq > 0) parts[chunk.slice(0, eq).toUpperCase()] = chunk.slice(eq + 1);
  }
  const freq = (parts["FREQ"] ?? "").toUpperCase();
  const interval = Math.max(1, Number(parts["INTERVAL"] ?? 1) || 1);
  const count = parts["COUNT"] ? Number(parts["COUNT"]) : null;
  const untilParsed = parts["UNTIL"] ? parseIcsDate(parts["UNTIL"]) : null;
  const until = untilParsed?.date ?? null;
  const byDay = (parts["BYDAY"] ?? "")
    .split(",")
    .map((d) => d.trim().slice(-2).toUpperCase())
    .filter((d) => WEEKDAYS.includes(d));

  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) {
    return keep(startDate) ? [startDate] : [];
  }

  const out: string[] = [];
  let produced = 0;
  let cursor = startDate;
  const hardStop = until && until < to ? until : to;

  for (let guard = 0; guard < 2000; guard += 1) {
    if (cursor > hardStop) break;
    if (count !== null && produced >= count) break;

    let candidates: string[] = [cursor];
    if (freq === "WEEKLY" && byDay.length) {
      const weekStart = addDays(cursor, -((new Date(`${cursor}T00:00:00Z`).getUTCDay() + 6) % 7));
      candidates = byDay
        .map((day) => addDays(weekStart, (WEEKDAYS.indexOf(day) + 6) % 7))
        .filter((d) => d >= startDate)
        .sort();
    } else if ((freq === "MONTHLY" || freq === "YEARLY") && byDay.length) {
      candidates = [cursor].filter((d) => byDay.includes(weekday(d)));
    }

    for (const candidate of candidates) {
      if (candidate > hardStop) continue;
      produced += 1;
      if (count !== null && produced > count) break;
      if (keep(candidate)) out.push(candidate);
      if (out.length >= limit) return out;
    }

    if (freq === "DAILY") cursor = addDays(cursor, interval);
    else if (freq === "WEEKLY") cursor = addDays(cursor, 7 * interval);
    else if (freq === "MONTHLY") cursor = addMonths(cursor, interval);
    else cursor = addMonths(cursor, 12 * interval);
  }

  return [...new Set(out)].sort();
}

export { addDays };
