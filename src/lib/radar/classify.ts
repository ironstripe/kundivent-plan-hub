/**
 * Shared classification for regional Radar sources.
 *
 * Municipal calendars rarely carry usable categories, so titles are matched
 * against a small, deliberately conservative keyword list. Every regional
 * adapter uses the same rules so the Radar filters stay comparable.
 */

const KEYWORD_CATEGORIES: { pattern: RegExp; category: string }[] = [
  { pattern: /(markt|märt|flohmarkt|weihnachtsmarkt|jahrmarkt)/i, category: "Markt" },
  { pattern: /(messe|ausstellung|vernissage|museum)/i, category: "Messe" },
  { pattern: /(fasnacht|umzug|brauchtum|1\.\s*august|silvester|adventsfenster)/i, category: "Brauchtum" },
  { pattern: /(konzert|musik|chor|jazz|blues|band|singen|orgel)/i, category: "Musik" },
  { pattern: /(kulinar|degustation|metzgete|brunch|dinner|wein|oktoberfest|apéro|apero)/i, category: "Kulinarik" },
  { pattern: /(kinder|famili|spielgruppe|geschichten|spielkafi|ludothek)/i, category: "Familie" },
  { pattern: /(lauf|turnier|sport|schwimm|velo|radmarathon|wander)/i, category: "Sport" },
  { pattern: /(theater|kino|film|lesung|führung|kunst|kultur|vortrag)/i, category: "Kultur" },
];

/** Maps free text (title, optionally description) to a Radar category. */
export function classifyCategory(title: string, extra?: string | null): string {
  const haystack = `${title} ${extra ?? ""}`;
  for (const { pattern, category } of KEYWORD_CATEGORIES) {
    if (pattern.test(haystack)) return category;
  }
  return "Sonstiges";
}

/** Deliberately conservative: only unmistakably large public events. */
const HIGH_RELEVANCE =
  /(stadtfest|städtlifest|dorffest|festival|fasnacht|weihnachtsmarkt|jahrmarkt|hafenfest|stein klingt|1\.\s*august|silvester|chilbi)/i;

export function classifyRelevance(title: string): "high" | "medium" | "low" {
  return HIGH_RELEVANCE.test(title) ? "high" : "medium";
}
