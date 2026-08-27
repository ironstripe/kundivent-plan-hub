import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listPending,
  removePending,
  subscribePending,
  updatePending,
  type PendingEvent,
} from "@/lib/offline-queue";
import { syncPlanningAreas, toEventRecord, type EventWithRelations } from "@/lib/events";
import { useIsOnline } from "@/lib/connection";

/** Statuses that make another entry a meaningful conflict. */
const BLOCKING = new Set(["confirmed", "provisional"]);

export function useCurrentUserId() {
  const { data } = useQuery({
    queryKey: ["auth-user-id"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getSession();
      return auth.session?.user.id ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
  return data ?? null;
}

/** Live list of this user's locally queued events. */
export function usePendingEvents(): PendingEvent[] {
  const userId = useCurrentUserId();
  const [records, setRecords] = useState<PendingEvent[]>([]);
  const version = useSyncExternalStore(
    subscribePending,
    () => queueVersion,
    () => 0,
  );

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setRecords([]);
      return;
    }
    void listPending(userId).then((list) => {
      if (!cancelled) setRecords(list);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, version]);

  return records;
}

let queueVersion = 0;
subscribePending(() => {
  queueVersion += 1;
});

export type SyncResult = {
  synced: number;
  conflicts: number;
  failed: number;
};

export { pendingToEventRow } from "@/lib/offline-queue";

async function findConflicts(record: PendingEvent) {
  const from = record.input.start_date;
  const to = record.input.end_date ?? record.input.start_date;
  const { data, error } = await supabase
    .from("events")
    .select("id, title, start_date, end_date, status, event_planning_areas(planning_area_id)")
    .lte("start_date", to)
    .or(`end_date.gte.${from},and(end_date.is.null,start_date.gte.${from})`);
  if (error) return [];

  return (data ?? []).filter((row) => {
    if (!BLOCKING.has(row.status)) return false;
    const areas = (row.event_planning_areas ?? []).map((a) => a.planning_area_id);
    return areas.some((id) => record.input.planning_area_ids.includes(id));
  });
}

/** Sequential, idempotent sync of all pending events for one user. */
export async function syncPendingEvents(userId: string): Promise<SyncResult> {
  const queue = await listPending(userId);
  const result: SyncResult = { synced: 0, conflicts: 0, failed: 0 };

  for (const record of queue) {
    try {
      await updatePending({ ...record, status: "syncing", error: null });

      // Idempotency: a previous attempt may already have written the row.
      const { data: existing } = await supabase
        .from("events")
        .select("id")
        .eq("offline_sync_id", record.sync_id)
        .maybeSingle();

      let eventId = existing?.id ?? null;
      let conflictNote: string | null = null;

      if (!eventId) {
        const conflicts = await findConflicts(record);
        if (conflicts.length) {
          conflictNote = conflicts.map((c) => c.title).join(", ");
        }
        const { data, error } = await supabase
          .from("events")
          .insert({
            ...toEventRecord(record.input),
            created_by: userId,
            offline_sync_id: record.sync_id,
          })
          .select("id")
          .single();
        if (error) throw error;
        eventId = data.id;
      }

      await syncPlanningAreas(eventId, record.input.planning_area_ids);
      await removePending(record.id);
      result.synced += 1;
      if (conflictNote) {
        result.conflicts += 1;
        toast.warning("Möglicher Konflikt", {
          description: `Während du offline warst, wurde für „${record.input.title}“ ein weiterer Eintrag im gleichen Zeitraum erstellt: ${conflictNote}. Beide Einträge bleiben bestehen.`,
          duration: 12000,
        });
      }
    } catch (error) {
      result.failed += 1;
      await updatePending({
        ...record,
        status: "error",
        attempts: record.attempts + 1,
        error: error instanceof Error ? error.message : "Unbekannter Fehler",
      });
    }
  }

  return result;
}

/**
 * Drives synchronisation: on app start (when online), on reconnect and on
 * manual retry. Sync itself lives in the app, not in the service worker.
 */
export function useOfflineSync() {
  const online = useIsOnline();
  const userId = useCurrentUserId();
  const pending = usePendingEvents();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const running = useRef(false);

  const run = useCallback(
    async (announce: boolean) => {
      if (!userId || running.current) return;
      const queue = await listPending(userId);
      if (!queue.length) return;
      running.current = true;
      setSyncing(true);
      try {
        const result = await syncPendingEvents(userId);
        await queryClient.invalidateQueries({ queryKey: ["events"] });
        if (announce && result.synced) {
          const parts = [`${result.synced} synchronisiert`];
          if (result.conflicts) parts.push(`${result.conflicts} Konflikt`);
          if (result.failed) parts.push(`${result.failed} fehlgeschlagen`);
          toast.success(
            result.synced === 1 && !result.conflicts && !result.failed
              ? "1 Offline-Eintrag synchronisiert"
              : parts.join(" · "),
          );
        } else if (announce && result.failed) {
          toast.error(`${result.failed} Offline-Einträge konnten nicht synchronisiert werden`);
        }
      } finally {
        running.current = false;
        setSyncing(false);
      }
    },
    [userId, queryClient],
  );

  // App start online + every reconnect.
  useEffect(() => {
    if (!online || !userId) return;
    void run(true);
  }, [online, userId, run]);

  return {
    pending,
    syncing,
    online,
    retry: () => void run(true),
    hasErrors: pending.some((p) => p.status === "error"),
  };
}
