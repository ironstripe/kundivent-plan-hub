import type { CSSProperties } from "react";
import type { EventStatus } from "@/lib/events";

/**
 * Presentation-only planning-area colour system.
 *
 * Colour values live in src/styles.css (--area-*). Components never hardcode
 * colours: they spread AREA_STYLE[key] onto the element, which sets the
 * --ev-* custom properties consumed by the class strings below.
 */

export const AREA_KEYS = [
  "event",
  "restaurant",
  "hofstube",
  "terrasse",
  "fishing",
  "hofladen",
  "default",
] as const;

export type AreaKey = (typeof AREA_KEYS)[number];

/** Display priority for events assigned to multiple planning areas. */
export const AREA_DISPLAY_PRIORITY: AreaKey[] = [
  "event",
  "restaurant",
  "hofstube",
  "terrasse",
  "fishing",
  "hofladen",
];

export function areaKeyFromName(name: string | undefined): AreaKey {
  const n = (name ?? "").toLowerCase();
  if (n.includes("pavillon") || n.startsWith("event")) return "event";
  if (n.includes("restaurant") || n.includes("carte")) return "restaurant";
  if (n.includes("hofstube")) return "hofstube";
  if (n.includes("terrasse")) return "terrasse";
  if (n.includes("fishing") || n.includes("kfh")) return "fishing";
  if (n.includes("hofladen")) return "hofladen";
  return "default";
}

/** One display colour per event, resolved through AREA_DISPLAY_PRIORITY. */
export function displayAreaKeyFromNames(names: string[]): AreaKey {
  const keys = new Set(names.map(areaKeyFromName));
  for (const key of AREA_DISPLAY_PRIORITY) if (keys.has(key)) return key;
  return "default";
}

export function displayAreaKey(
  areaIds: string[],
  areaNameById: Map<string, string>,
): AreaKey {
  return displayAreaKeyFromNames(areaIds.map((id) => areaNameById.get(id) ?? ""));
}


type EvVars = CSSProperties & Record<`--${string}`, string>;

function vars(key: AreaKey): EvVars {
  return {
    "--ev-accent": `var(--area-${key})`,
    "--ev-bg": `var(--area-${key}-bg)`,
    "--ev-soft": `var(--area-${key}-soft)`,
    "--ev-border": `var(--area-${key}-border)`,
    "--ev-hover": `var(--area-${key}-hover)`,
    "--ev-faint": `var(--area-${key}-faint)`,
  } as EvVars;
}

export const AREA_STYLE: Record<AreaKey, EvVars> = {
  event: vars("event"),
  restaurant: vars("restaurant"),
  hofstube: vars("hofstube"),
  terrasse: vars("terrasse"),
  fishing: vars("fishing"),
  hofladen: vars("hofladen"),
  default: vars("default"),
};

/** Small solid swatch colour for legends / list rows. */
export const AREA_SWATCH: Record<AreaKey, string> = {
  event: "var(--area-event)",
  restaurant: "var(--area-restaurant)",
  hofstube: "var(--area-hofstube)",
  terrasse: "var(--area-terrasse)",
  fishing: "var(--area-fishing)",
  hofladen: "var(--area-hofladen)",
  default: "var(--area-default)",
};

const BASE =
  "border border-l-[7px] font-medium transition-[background-color,border-color] focus-visible:outline-none";

/**
 * Status modulates the planning-area colour — it is not a second colour system.
 * confirmed = filled · provisional = dashed outline on a pale surface ·
 * idea = very light · cancelled = neutral grey.
 */
export function eventBlockClasses(status: EventStatus, isHoliday = false) {
  if (isHoliday)
    return `${BASE} surface-hatch border-dashed border-border border-l-border bg-muted text-muted-foreground`;

  switch (status) {
    case "confirmed":
      return `${BASE} border-[var(--ev-border)] border-l-[var(--ev-accent)] bg-[var(--ev-bg)] text-foreground font-medium hover:bg-[var(--ev-hover)]`;
    case "provisional":
      return `${BASE} border-dashed border-[var(--ev-accent)] border-l-[var(--ev-accent)] bg-[var(--ev-soft)] text-foreground hover:bg-[var(--ev-bg)]`;
    case "idea":
      return `${BASE} border-dotted border-border border-l-[var(--ev-faint)] bg-card text-muted-foreground hover:bg-accent/50`;
    default:
      return `${BASE} border-border border-l-border bg-muted/50 text-muted-foreground/70 line-through hover:bg-muted`;
  }
}

/** Tiny non-colour status marker so status never relies on colour alone. */
export function statusMark(status: EventStatus, isHoliday = false) {
  if (isHoliday) return "×";
  switch (status) {
    case "confirmed":
      return "●";
    case "provisional":
      return "◐";
    case "cancelled":
      return "✕";
    default:
      return "○";
  }
}
