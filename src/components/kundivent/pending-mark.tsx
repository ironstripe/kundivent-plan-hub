import { Check, CloudUpload } from "lucide-react";
import { cn } from "@/lib/utils";
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

export const DEPOSIT_LABEL = "Anzahlung eingegangen";

/**
 * Small green check shown at the far right of compact event chips when a
 * deposit has been received. Renders nothing otherwise.
 */
export function DepositMark({
  event,
  className,
}: {
  event: EventWithRelations;
  className?: string;
}) {
  if (!event.deposit_received) return null;
  return (
    <Check
      role="img"
      aria-label={DEPOSIT_LABEL}
      title={DEPOSIT_LABEL}
      strokeWidth={3.5}
      className={cn("ml-auto size-3 shrink-0 text-success", className)}
    />
  );
}
