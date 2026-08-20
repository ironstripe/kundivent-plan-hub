import { CircleDashed, CircleDot, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusLabel, type EventStatus } from "@/lib/events";

/**
 * Status badges stay neutral: colour in Kundivent belongs to planning areas.
 * Shape (icon) plus label carry the meaning; only the confirmed state gets a
 * slightly stronger neutral surface.
 */
const STYLES: Record<EventStatus, { className: string; Icon: typeof CircleDot }> = {
  idea: {
    className: "border-border/70 bg-transparent text-muted-foreground",
    Icon: CircleDashed,
  },
  provisional: {
    className: "border-dashed border-foreground/40 bg-transparent text-foreground/80",
    Icon: CircleDot,
  },
  confirmed: {
    className: "border-foreground/25 bg-foreground/10 text-foreground font-semibold",
    Icon: CheckCircle2,
  },
  cancelled: {
    className: "border-border/60 bg-transparent text-muted-foreground/70 line-through",
    Icon: XCircle,
  },
};

export function EventStatusBadge({
  status,
  className,
}: {
  status: EventStatus;
  className?: string;
}) {
  const { className: tone, Icon } = STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon aria-hidden className="size-3" />
      {statusLabel(status)}
    </span>
  );
}
