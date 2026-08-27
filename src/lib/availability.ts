// Reusable availability domain logic.
// Availability is derived from events — never stored in the database.

import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HOLIDAY_CATEGORY, type EventRow, type EventWithRelations } from "@/lib/events";
import type { Category } from "@/lib/master-data";

export type AvailabilityState = "free" | "provisional" | "occupied" | "closed";

export const AVAILABILITY_LABEL: Record<AvailabilityState, string> = {
  free: "Frei",
  provisional: "Provisorisch",
  occupied: "Belegt",
  closed: "Betriebsferien",
};

const PRIORITY: Record<AvailabilityState, number> = {
  closed: 3,
  occupied: 2,
  provisional: 1,
  free: 0,
};

export function mergeStates(states: AvailabilityState[]): AvailabilityState {
  return states.reduce<AvailabilityState>(
    (acc, s) => (PRIORITY[s] > PRIORITY[acc] ? s : acc),
    "free",
  );
}

/** Blocking statuses: idea and cancelled never block. */
export function blocksAvailability(status: EventRow["status"]): boolean {
  return status === "provisional" || status === "confirmed";
}

export function coversDate(event: Pick<EventRow, "start_date" | "end_date">, date: string) {
  const end = event.end_date ?? event.start_date;
  return date >= event.start_date && date <= end;
}

export type AreaAvailability = {
  areaId: string;
  state: AvailabilityState;
  events: EventWithRelations[];
};

export type DayAvailability = {
  date: string;
  state: AvailabilityState;
  areas: AreaAvailability[];
  /** All blocking events across the selected areas, deduplicated. */
  blockingEvents: EventWithRelations[];
};

export type AvailabilityIndex = {
  /** date -> events covering that date (blocking only) */
  byDate: Map<string, EventWithRelations[]>;
  isHoliday: (event: EventWithRelations) => boolean;
};

export function buildAvailabilityIndex(
  events: EventWithRelations[],
  categories: Category[],
): AvailabilityIndex {
  const holidayCategoryIds = new Set(
    categories.filter((c) => c.name === HOLIDAY_CATEGORY).map((c) => c.id),
  );
  const byDate = new Map<string, EventWithRelations[]>();
  for (const event of events) {
    if (!blocksAvailability(event.status)) continue;
    const end = event.end_date ?? event.start_date;
    let cursor = new Date(`${event.start_date}T00:00:00Z`);
    const last = new Date(`${end}T00:00:00Z`);
    // guard against malformed ranges
    if (Number.isNaN(cursor.getTime()) || Number.isNaN(last.getTime())) continue;
    while (cursor <= last) {
      const key = cursor.toISOString().slice(0, 10);
      const list = byDate.get(key);
      if (list) list.push(event);
      else byDate.set(key, [event]);
      cursor = new Date(cursor.getTime() + 86400000);
    }
  }
  return {
    byDate,
    isHoliday: (event) => holidayCategoryIds.has(event.category_id),
  };
}

/**
 * Calculate availability of a single date for the given planning areas.
 * Returns a rich result: overall state, per-area state and blocking events.
 */
export function calculateAvailability(
  date: string,
  selectedAreaIds: string[],
  index: AvailabilityIndex,
): DayAvailability {
  const dayEvents = index.byDate.get(date) ?? [];
  const areas: AreaAvailability[] = selectedAreaIds.map((areaId) => {
    const events = dayEvents.filter((e) => e.planning_area_ids.includes(areaId));
    const state = mergeStates(
      events.map((e) =>
        index.isHoliday(e) && e.status === "confirmed"
          ? "closed"
          : e.status === "confirmed"
            ? "occupied"
            : "provisional",
      ),
    );
    return { areaId, state, events };
  });

  const blockingEvents: EventWithRelations[] = [];
  const seen = new Set<string>();
  for (const area of areas) {
    for (const e of area.events) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      blockingEvents.push(e);
    }
  }

  return {
    date,
    state: mergeStates(areas.map((a) => a.state)),
    areas,
    blockingEvents,
  };
}

/** Events overlapping a date range [from, to] (inclusive), fetched once per range. */
export function eventsInRangeQuery(from: string, to: string) {
  return queryOptions({
    queryKey: ["events", "range", from, to],
    queryFn: async (): Promise<EventWithRelations[]> => {
      const { data, error } = await supabase
        .from("events")
        .select("*, event_planning_areas(planning_area_id)")
        .lte("start_date", to)
        .or(`end_date.gte.${from},and(end_date.is.null,start_date.gte.${from})`)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const { event_planning_areas, ...event } = row as EventRow & {
          event_planning_areas: { planning_area_id: string }[] | null;
        };
        return {
          ...event,
          planning_area_ids: (event_planning_areas ?? []).map((a) => a.planning_area_id),
        };
      });
    },
  });
}

export function useEventsInRange(from: string, to: string) {
  const query = useQuery(eventsInRangeQuery(from, to));
  const pending = usePendingEventRows();
  return useMemo(() => {
    const overlapping = pending.filter((event) => {
      const end = event.end_date ?? event.start_date;
      return event.start_date <= to && end >= from;
    });
    return { ...query, data: query.data ? [...overlapping, ...query.data] : query.data };
  }, [query, pending, from, to]);
}

export function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  let cursor = new Date(`${from}T00:00:00Z`);
  const last = new Date(`${to}T00:00:00Z`);
  while (cursor <= last) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 86400000);
  }
  return out;
}

/** 1 = Monday … 7 = Sunday */
export function isoWeekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}
