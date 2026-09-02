/**
 * Prepared regional-event adapters.
 *
 * These sources have no confirmed structured interface (feed/API/iCal) yet.
 * They exist so a real implementation can be dropped in later without any
 * change to the Radar data model or UI. No endpoint is invented here and no
 * HTML scraping is performed.
 */
import type { RadarSourceAdapter } from "@/lib/radar/types";

class SourceNotConnectedError extends Error {
  constructor(label: string) {
    super(`${label}: Quelle noch nicht verbunden.`);
    this.name = "SourceNotConnectedError";
  }
}

function preparedAdapter(sourceId: string, label: string): RadarSourceAdapter {
  return {
    sourceId,
    label,
    connected: false,
    async fetchEvents() {
      throw new SourceNotConnectedError(label);
    },
  };
}

/** Official structured feed is still being clarified. */
export const schaffhauserlandAdapter = preparedAdapter(
  "schaffhauserland",
  "Schaffhauserland Tourismus",
);

export const frauenfeldAdapter = preparedAdapter(
  "frauenfeld-aktuell",
  "Frauenfeld aktuell – Veranstaltungskalender",
);
