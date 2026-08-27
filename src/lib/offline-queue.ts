import type { EventInput, EventWithRelations } from "@/lib/events";
import { PENDING_STORE, idbAvailable, idbDelete, idbGetAll, idbPut } from "@/lib/offline-db";

export type PendingStatus = "pending" | "syncing" | "error";

export type PendingEvent = {
  /** Temporary local id, never a Supabase UUID. */
  id: string;
  /** Owning authenticated user — queues are never shared between accounts. */
  user_id: string;
  /** Idempotency key stored on the server row to prevent duplicates on retry. */
  sync_id: string;
  input: EventInput;
  created_at: string;
  status: PendingStatus;
  error?: string | null;
  conflict?: string | null;
  attempts: number;
};

const listeners = new Set<() => void>();

export function subscribePending(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

export function newLocalId() {
  return `local_${crypto.randomUUID()}`;
}

export async function listPending(userId: string): Promise<PendingEvent[]> {
  if (!idbAvailable()) return [];
  try {
    const all = await idbGetAll<PendingEvent>(PENDING_STORE);
    return all
      .filter((record) => record.user_id === userId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  } catch {
    return [];
  }
}

export async function addPending(userId: string, input: EventInput): Promise<PendingEvent> {
  const record: PendingEvent = {
    id: newLocalId(),
    user_id: userId,
    sync_id: crypto.randomUUID(),
    input,
    created_at: new Date().toISOString(),
    status: "pending",
    error: null,
    conflict: null,
    attempts: 0,
  };
  await idbPut(PENDING_STORE, record);
  emit();
  return record;
}

export async function updatePending(record: PendingEvent) {
  await idbPut(PENDING_STORE, record);
  emit();
}

export async function removePending(id: string) {
  await idbDelete(PENDING_STORE, id);
  emit();
}

/** Maps a queued record to the shape the calendar views already render. */
export function pendingToEventRow(record: PendingEvent): EventWithRelations {
  const input = record.input;
  return {
    id: record.id,
    local_id: record.id,
    is_pending: true,
    pending_status: record.status,
    pending_error: record.error ?? null,
    pending_conflict: record.conflict ?? null,
    title: input.title,
    category_id: input.category_id,
    planning_area_ids: [...input.planning_area_ids],
    start_date: input.start_date,
    end_date: input.end_date,
    all_day: input.all_day,
    start_time: input.start_time,
    end_time: input.end_time,
    status: input.status,
    pax: input.pax,
    notes: input.notes,
    deposit_received: input.deposit_received,
    deposit_amount: input.deposit_amount,
    deposit_received_at: input.deposit_received_at,
    responsible_user_id: input.responsible_user_id,
    created_by: record.user_id,
    inbound_email_token: input.inbound_email_token ?? null,
    created_at: record.created_at,
    updated_at: record.created_at,
    external_source: null,
    external_id: null,
    sync_status: null,
    last_synced_at: null,
    migration_source: null,
    migration_source_ref: null,
    migration_review_required: false,
  } as unknown as EventWithRelations;
}
