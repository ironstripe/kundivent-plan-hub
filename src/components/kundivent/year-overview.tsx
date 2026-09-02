import { useMemo } from "react";
import { DepositMark, PendingMark } from "@/components/kundivent/pending-mark";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EventStatusBadge } from "@/components/kundivent/event-status-badge";
import { HOLIDAY_CATEGORY, formatDateRange, type EventWithRelations } from "@/lib/events";
import { AREA_STYLE, displayAreaKey, eventBlockClasses, statusMark } from "@/lib/area-theme";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["M", "D", "M", "D", "F", "S", "S"];

const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

function iso(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

function statusRank(status: string) {
  return status === "confirmed" ? 0 : status === "provisional" ? 1 : status === "idea" ? 2 : 3;
}

/** date (ISO) → events occupying that date, ordered by status prominence. */
function buildDayIndex(events: EventWithRelations[], year: number) {
  const map = new Map<string, EventWithRelations[]>();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;
  for (const event of events) {
    const start = event.start_date < yearStart ? yearStart : event.start_date;
    const rawEnd = event.end_date ?? event.start_date;
    const end = rawEnd > yearEnd ? yearEnd : rawEnd;
    if (start > end) continue;
    let cursor = new Date(`${start}T00:00:00Z`).getTime();
    const last = new Date(`${end}T00:00:00Z`).getTime();
    while (cursor <= last) {
      const key = iso(new Date(cursor));
      const bucket = map.get(key);
      if (bucket) bucket.push(event);
      else map.set(key, [event]);
      cursor += 86400000;
    }
  }
  for (const list of map.values())
    list.sort((a, b) => statusRank(a.status) - statusRank(b.status));
  return map;
}

export function YearOverview({
  year,
  events,
  today,
  categoryById,
  areaNameById,
  onOpenEvent,
  onOpenMonth,
}: {
  year: number;
  events: EventWithRelations[];
  today: string;
  categoryById: Map<string, { name: string; color: string }>;
  areaNameById: Map<string, string>;
  onOpenEvent: (event: EventWithRelations) => void;
  onOpenMonth: (month: number) => void;
}) {
  const dayIndex = useMemo(() => buildDayIndex(events, year), [events, year]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {MONTHS.map((label, month) => (
        <MiniMonth
          key={label}
          label={label}
          year={year}
          month={month}
          today={today}
          dayIndex={dayIndex}
          categoryById={categoryById}
          areaNameById={areaNameById}
          onOpenEvent={onOpenEvent}
          onOpenMonth={onOpenMonth}
        />
      ))}
    </div>
  );
}

function MiniMonth({
  label,
  year,
  month,
  today,
  dayIndex,
  categoryById,
  areaNameById,
  onOpenEvent,
  onOpenMonth,
}: {
  label: string;
  year: number;
  month: number;
  today: string;
  dayIndex: Map<string, EventWithRelations[]>;
  categoryById: Map<string, { name: string; color: string }>;
  areaNameById: Map<string, string>;
  onOpenEvent: (event: EventWithRelations) => void;
  onOpenMonth: (month: number) => void;
}) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const cells: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => iso(new Date(Date.UTC(year, month, i + 1)))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <section className="rounded-md border border-border bg-card p-2">
      <button
        type="button"
        onClick={() => onOpenMonth(month)}
        className="mb-1.5 w-full rounded-sm px-1 py-0.5 text-left text-xs font-semibold tracking-tight hover:bg-accent"
        title={`${label} im Monatskalender öffnen`}
      >
        {label}
      </button>

      <div className="grid grid-cols-7 gap-px text-center">
        {WEEKDAYS.map((wd, i) => (
          <div key={i} className="pb-0.5 text-[9px] font-medium text-muted-foreground">
            {wd}
          </div>
        ))}
        {cells.map((date, index) =>
          date ? (
            <DayCell
              key={date}
              date={date}
              today={today}
              events={dayIndex.get(date) ?? []}
              categoryById={categoryById}
              areaNameById={areaNameById}
              onOpenEvent={onOpenEvent}
            />
          ) : (
            <div key={`empty-${index}`} />
          ),
        )}
      </div>
    </section>
  );
}

function DayCell({
  date,
  today,
  events,
  categoryById,
  areaNameById,
  onOpenEvent,
}: {
  date: string;
  today: string;
  events: EventWithRelations[];
  categoryById: Map<string, { name: string; color: string }>;
  areaNameById: Map<string, string>;
  onOpenEvent: (event: EventWithRelations) => void;
}) {
  const day = Number(date.slice(8, 10));
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const isWeekend = weekday >= 5;
  const isToday = date === today;
  const primary = events[0];

  if (!primary) {
    return (
      <div
        className={cn(
          "flex h-6 items-center justify-center rounded-[2px] text-[10px] tabular-nums",
          isWeekend ? "bg-muted/40 text-muted-foreground/70" : "text-muted-foreground",
          isToday && "ring-1 ring-primary",
        )}
      >
        {day}
      </div>
    );
  }

  const isHoliday = categoryById.get(primary.category_id)?.name === HOLIDAY_CATEGORY;
  const areaKey = displayAreaKey(primary.planning_area_ids, areaNameById);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          style={AREA_STYLE[areaKey]}
          title={primary.title}
          className={cn(
            "flex h-6 items-center justify-center gap-0.5 rounded-[2px] px-0.5 text-[10px] tabular-nums",
            eventBlockClasses(primary.status, isHoliday),
            "border-l-[3px]",
            isToday && "ring-1 ring-primary",
          )}
        >
          <span className="font-semibold">{day}</span>
          {events.length > 1 ? (
            <span className="text-[8px] font-medium opacity-70">+{events.length - 1}</span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-64 space-y-1 p-2">
        <p className="px-1 text-[11px] font-medium text-muted-foreground tabular-nums">
          {formatDateRange(date, null)}
        </p>
        {events.map((event) => {
          const key = displayAreaKey(event.planning_area_ids, areaNameById);
          const holiday = categoryById.get(event.category_id)?.name === HOLIDAY_CATEGORY;
          return (
            <button
              key={event.id}
              type="button"
              onClick={() => onOpenEvent(event)}
              style={AREA_STYLE[key]}
              className={cn(
                "flex w-full items-center gap-1.5 rounded-sm px-1.5 py-1 text-left text-xs",
                eventBlockClasses(event.status, holiday),
              )}
            >
              <span aria-hidden className="text-[9px] opacity-70">
                {statusMark(event.status, holiday)}
              </span>
              <DepositMark event={event} /><PendingMark event={event} /><span className="min-w-0 flex-1 truncate">{event.title}</span>
              <EventStatusBadge status={event.status} />
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
