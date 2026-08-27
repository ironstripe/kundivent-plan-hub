import { CalendarClock, Clock, Users, MoveRight, Lock } from "lucide-react";
import { PendingMark } from "@/components/kundivent/pending-mark";
import { cn } from "@/lib/utils";
import { EventStatusBadge } from "@/components/kundivent/event-status-badge";
import { AREA_STYLE, displayAreaKeyFromNames } from "@/lib/area-theme";
import {
  HOLIDAY_CATEGORY,
  formatTimeRange,
  type EventStatus,
  type EventWithRelations,
} from "@/lib/events";


const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

export function formatTimelineDate(start: string, end: string | null) {
  const [, sm, sd] = start.split("-");
  const startLabel = `${sd}. ${MONTHS_SHORT[Number(sm) - 1]}`;
  if (!end || end === start) return startLabel;
  const [, em, ed] = end.split("-");
  if (em === sm) return `${sd}.–${ed}. ${MONTHS_SHORT[Number(sm) - 1]}`;
  return `${sd}. ${MONTHS_SHORT[Number(sm) - 1]} – ${ed}. ${MONTHS_SHORT[Number(em) - 1]}`;
}

export function TimelineEventRow({
  event,
  areaNames,
  category,
  today,
  onOpen,
}: {
  event: EventWithRelations;
  areaNames: string[];
  category: { name: string; color: string } | undefined;
  today: string;
  onOpen: (event: EventWithRelations) => void;
}) {
  const isHoliday = category?.name === HOLIDAY_CATEGORY;
  const areaKey = displayAreaKeyFromNames(areaNames);

  const isCancelled = event.status === "cancelled";
  const end = event.end_date ?? event.start_date;
  const continues = end.slice(0, 7) !== event.start_date.slice(0, 7);
  const isRunning = event.start_date <= today && today <= end;
  const time = event.all_day
    ? null
    : formatTimeRange(event.all_day, event.start_time, event.end_time);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(event)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(event);
        }
      }}
      style={AREA_STYLE[areaKey]}
      className={cn(
        "group grid cursor-pointer grid-cols-[7px_1fr] gap-0 rounded-sm border border-border bg-card transition-colors hover:border-[var(--ev-border)] hover:bg-[var(--ev-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        isHoliday && "border-dashed bg-muted/40",
        isCancelled && "opacity-60",
      )}
    >
      <span
        aria-hidden
        className={cn("rounded-l-sm", isHoliday ? "bg-border" : "bg-[var(--ev-accent)]")}
      />
      <div className="flex flex-col gap-1 px-2.5 py-1.5 sm:flex-row sm:items-center sm:gap-3">
        <span
          className={cn(
            "w-full shrink-0 text-xs font-medium tabular-nums text-muted-foreground sm:w-32",
            isRunning && "text-primary",
          )}
        >
          {formatTimelineDate(event.start_date, event.end_date)}
        </span>

        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {isHoliday ? (
            <Lock aria-hidden className="mr-1.5 inline size-3.5 align-[-2px] text-muted-foreground" />
          ) : null}
          <PendingMark event={event} /><span className={cn(isCancelled && "line-through")}>{event.title}</span>
          {continues ? (
            <MoveRight
              aria-label="läuft in den Folgemonat"
              className="ml-1.5 inline size-3.5 align-[-2px] text-muted-foreground"
            />
          ) : null}
        </span>

        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {areaNames.join(" · ") || "—"}
        </span>

        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:shrink-0">
          {category ? (
            <span className="whitespace-nowrap rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[11px] leading-none">
              {category.name}
            </span>
          ) : null}

          {time ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
              <Clock aria-hidden className="size-3" />
              {time}
            </span>
          ) : null}
          {event.pax ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap tabular-nums">
              <Users aria-hidden className="size-3" />
              {event.pax}
            </span>
          ) : null}
          {isHoliday ? (
            <span className="inline-flex items-center gap-1 whitespace-nowrap">
              <CalendarClock aria-hidden className="size-3" />
              geschlossen
            </span>
          ) : null}
          <EventStatusBadge status={event.status as EventStatus} />
        </span>
      </div>
    </div>
  );
}
