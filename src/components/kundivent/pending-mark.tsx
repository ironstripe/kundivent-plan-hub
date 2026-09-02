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

/** Small green bullet shown before the title when a deposit has been received. */
export function DepositMark({
  event,
  className,
}: {
  event: EventWithRelations;
  className?: string;
}) {
  if (!event.deposit_received) return null;
  return (
    <span
      role="img"
      aria-label={DEPOSIT_LABEL}
      title={DEPOSIT_LABEL}
      className={cn(
        "mr-1 inline-block size-1.5 shrink-0 rounded-full bg-success align-[-2px]",
        className,
      )}
    />
  );
}
