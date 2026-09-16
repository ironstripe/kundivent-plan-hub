import { ExternalLink } from "lucide-react";
import { useEventHandover } from "@/lib/kundicalc";
import { formatCreatedAt } from "@/lib/events";

/**
 * Read-only KundiCalc reference on an event. No figures are duplicated and
 * Kundivent never writes back to KundiCalc.
 */
export function KundiCalcSection({ eventId }: { eventId: string | null }) {
  const handover = useEventHandover(eventId);
  const row = handover.data;
  if (!eventId || !row) return null;

  return (
    <section className="space-y-1.5 rounded-md border border-border bg-muted/30 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-tight">KundiCalc</h3>
        {row.calculation_url ? (
          <a
            href={row.calculation_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            Kalkulation öffnen
            <ExternalLink className="size-3" />
          </a>
        ) : null}
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
        <dt>Übergabe</dt>
        <dd className="text-foreground">{formatCreatedAt(row.completed_at)}</dd>
        <dt>Referenz</dt>
        <dd className="font-mono text-[10px] text-foreground">{row.source_event_id}</dd>
        {row.source_calculation_id ? (
          <>
            <dt>Kalkulation</dt>
            <dd className="font-mono text-[10px] text-foreground">{row.source_calculation_id}</dd>
          </>
        ) : null}
      </dl>
    </section>
  );
}
