import type { RadarRelevance, RadarType } from "@/lib/radar/types";

/** Presentation-only helpers for Radar. Colour values live in src/styles.css. */

export const RADAR_CHIP_CLASS: Record<RadarType, string> = {
  school_holiday:
    "border-l-2 border-l-radar-school bg-[var(--radar-school-band-strong)] text-foreground",
  public_holiday: "border-l-2 border-l-radar-holiday bg-[var(--radar-holiday-bg)] text-foreground",
  regional_event:
    "border border-[var(--radar-regional-border)] bg-[var(--radar-regional-bg)] text-foreground",
  theme_day: "border border-[var(--radar-theme-border)] bg-[var(--radar-theme-bg)] text-foreground",
};

export const RADAR_DOT_CLASS: Record<RadarType, string> = {
  school_holiday: "bg-radar-school",
  public_holiday: "bg-radar-holiday",
  regional_event: "bg-radar-regional",
  theme_day: "bg-radar-theme",
};

export const RELEVANCE_CLASS: Record<RadarRelevance, string> = {
  high: "font-semibold",
  medium: "font-medium",
  low: "opacity-70",
};

export function formatRadarRange(start: string, end: string | null) {
  const fmt = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}.${m}.${y}`;
  };
  if (!end || end === start) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}
