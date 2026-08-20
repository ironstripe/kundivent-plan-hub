// Swiss public holidays (Kanton Schaffhausen) — used as subtle calendar context only.

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function shift(base: Date, days: number) {
  const d = new Date(base.getTime() + days * 86400000);
  return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export type PublicHoliday = { date: string; name: string };

export function publicHolidays(year: number): PublicHoliday[] {
  const easter = easterSunday(year);
  return [
    { date: iso(year, 1, 1), name: "Neujahr" },
    { date: iso(year, 1, 2), name: "Berchtoldstag" },
    { date: shift(easter, -2), name: "Karfreitag" },
    { date: shift(easter, 0), name: "Ostern" },
    { date: shift(easter, 1), name: "Ostermontag" },
    { date: iso(year, 5, 1), name: "Tag der Arbeit" },
    { date: shift(easter, 39), name: "Auffahrt" },
    { date: shift(easter, 50), name: "Pfingstmontag" },
    { date: iso(year, 8, 1), name: "Bundesfeier" },
    { date: iso(year, 12, 25), name: "Weihnachten" },
    { date: iso(year, 12, 26), name: "Stephanstag" },
  ].sort((a, b) => a.date.localeCompare(b.date));
}
