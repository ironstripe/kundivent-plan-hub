import { CircleDashed, CircleDot, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusLabel, type EventStatus } from "@/lib/events";

const STYLES: Record<EventStatus, { className: string; Icon: typeof CircleDot }> = {
  idea: {
    className: "border-border bg-muted text-muted-foreground",
    Icon: CircleDashed,
  },
  provisional: {
    className: "border-warning/40 bg-warning/10 text-warning-foreground",
    Icon: CircleDot,
  },
  confirmed: {
    className: "border-primary/40 bg-primary/10 text-primary",
    Icon: CheckCircle2,
  },
  cancelled: {
    className: "border-destructive/40 bg-destructive/10 text-destructive",
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
