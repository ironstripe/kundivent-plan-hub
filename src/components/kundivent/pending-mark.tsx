import { CloudUpload } from "lucide-react";
import type { EventWithRelations } from "@/lib/events";

/** Marks entries that only exist in the local offline queue. */
export function PendingMark({ event, className }: { event: EventWithRelations; className?: string }) {
  if (!event.is_pending) return null;
  return (
    <CloudUpload
      aria-label="Noch nicht synchronisiert"
      className={className ?? "mr-1 inline size-3 shrink-0 align-[-2px] opacity-80"}
    />
  );
}
