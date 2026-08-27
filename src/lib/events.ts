import { useEffect, useMemo, useState } from "react";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assertOnline } from "@/lib/connection";
import { listPending, pendingToEventRow, subscribePending } from "@/lib/offline-queue";
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
  /** Set for entries that only exist in the local offline queue. */
  is_pending?: boolean;
  local_id?: string;
  pending_status?: "pending" | "syncing" | "error";
  pending_error?: string | null;
  pending_conflict?: string | null;
};

export const isPendingEvent = (event: { is_pending?: boolean }) => event.is_pending === true;

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

/** Locally queued (offline created) events for the signed-in user. */
export function usePendingEventRows(): EventWithRelations[] {
  const [rows, setRows] = useState<EventWithRelations[]>([]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      // getSession() reads local storage and therefore also works offline.
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user.id;
      if (!userId) {
        if (active) setRows([]);
        return;
      }
      const list = await listPending(userId);
      if (active) setRows(list.map(pendingToEventRow));
    };
    void load();
    const unsubscribe = subscribePending(() => void load());
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return rows;
}

export function useEvents() {
  const query = useQuery(eventsQuery);
  const pending = usePendingEventRows();
  return useMemo(
    () => ({ ...query, data: query.data ? [...pending, ...query.data] : query.data }),
    [query, pending],
  );
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
  deposit_received_at: string | null;
  responsible_user_id: string | null;
};

export async function syncPlanningAreas(eventId: string, areaIds: string[]) {
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

export function toEventRecord(input: EventInput) {
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
    deposit_received: input.deposit_received,
    deposit_amount: input.deposit_received ? input.deposit_amount : null,
    deposit_received_at: input.deposit_received ? input.deposit_received_at : null,
    responsible_user_id: input.responsible_user_id,
  };
}

export function useSaveEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: EventInput }) => {
      assertOnline();
      if (id) {
        const { error } = await supabase.from("events").update(toEventRecord(input)).eq("id", id);
        if (error) throw error;
        await syncPlanningAreas(id, input.planning_area_ids);
        return id;
      }
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("events")
        .insert({ ...toEventRecord(input), created_by: auth.user?.id ?? null })
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
      assertOnline();
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

export function formatCreatedAt(value: string | null | undefined, withTime = true) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  return withTime ? `${date}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
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
