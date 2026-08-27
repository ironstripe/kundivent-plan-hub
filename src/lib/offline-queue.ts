import type { EventInput } from "@/lib/events";
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
