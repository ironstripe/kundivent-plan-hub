import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type EventStatus = "idea" | "provisional" | "confirmed" | "cancelled";

export const EVENT_STATUSES: { value: EventStatus; label: string }[] = [
  { value: "idea", label: "Idee" },
  { value: "provisional", label: "Provisorisch" },
  { value: "confirmed", label: "Bestätigt" },
  { value: "cancelled", label: "Abgesagt" },
];

export const statusLabel = (status: EventStatus) =>
  EVENT_STATUSES.find((s) => s.value === status)?.label ?? status;

export const HOLIDAY_CATEGORY = "Betriebsferien";
export const HOLIDAY_ALLOWED_AREAS = [
  "Restaurant / À la Carte",
  "Event / Pavillon",
  "Hofstube",
];

export type EventRow = Tables<"events">;

export type EventWithRelations = EventRow & {
  planning_area_ids: string[];
};

export const eventsQuery = queryOptions({
  queryKey: ["events"],
  queryFn: async (): Promise<EventWithRelations[]> => {
    const { data, error } = await supabase
      .from("events")
      .select("*, event_planning_areas(planning_area_id)")
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

export function useEvents() {
  return useQuery(eventsQuery);
}

export type EventInput = {
  title: string;
  status: EventStatus;
  category_id: string;
  planning_area_ids: string[];
  start_date: string;
  end_date: string | null;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  pax: number | null;
  notes: string | null;
  deposit_received: boolean;
  deposit_amount: number | null;
};

async function syncPlanningAreas(eventId: string, areaIds: string[]) {
  const { data: existing, error: readError } = await supabase
    .from("event_planning_areas")
    .select("id, planning_area_id")
    .eq("event_id", eventId);
  if (readError) throw readError;

  const current = existing ?? [];
  const toRemove = current.filter((r) => !areaIds.includes(r.planning_area_id));
  const toAdd = areaIds.filter((id) => !current.some((r) => r.planning_area_id === id));

  if (toRemove.length) {
    const { error } = await supabase
      .from("event_planning_areas")
      .delete()
      .in(
        "id",
        toRemove.map((r) => r.id),
      );
    if (error) throw error;
  }
  if (toAdd.length) {
    const { error } = await supabase
      .from("event_planning_areas")
      .insert(toAdd.map((planning_area_id) => ({ event_id: eventId, planning_area_id })));
    if (error) throw error;
  }
}

function toRecord(input: EventInput) {
  return {
    title: input.title,
    status: input.status,
    category_id: input.category_id,
    start_date: input.start_date,
    end_date: input.end_date,
    all_day: input.all_day,
    start_time: input.all_day ? null : input.start_time,
    end_time: input.all_day ? null : input.end_time,
    pax: input.pax,
    notes: input.notes,
  };
}

export function useSaveEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: EventInput }) => {
      if (id) {
        const { error } = await supabase.from("events").update(toRecord(input)).eq("id", id);
        if (error) throw error;
        await syncPlanningAreas(id, input.planning_area_ids);
        return id;
      }
      const { data, error } = await supabase
        .from("events")
        .insert(toRecord(input))
        .select("id")
        .single();
      if (error) throw error;
      await syncPlanningAreas(data.id, input.planning_area_ids);
      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error: linkError } = await supabase
        .from("event_planning_areas")
        .delete()
        .eq("event_id", id);
      if (linkError) throw linkError;
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function formatDateRange(start: string, end: string | null) {
  const fmt = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}.${m}.${y}`;
  };
  if (!end || end === start) return fmt(start);
  return `${fmt(start)} – ${fmt(end)}`;
}

export function formatTimeRange(
  allDay: boolean,
  start: string | null,
  end: string | null,
): string {
  if (allDay) return "Ganztägig";
  const trim = (t: string | null) => (t ? t.slice(0, 5) : "");
  if (start && end) return `${trim(start)} – ${trim(end)}`;
  if (start) return `ab ${trim(start)}`;
  if (end) return `bis ${trim(end)}`;
  return "—";
}
