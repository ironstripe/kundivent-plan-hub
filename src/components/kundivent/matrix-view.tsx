import { useEffect, useMemo, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  HOLIDAY_CATEGORY,
  formatDateRange,
  formatTimeRange,
  statusLabel,
  type EventWithRelations,
} from "@/lib/events";
import type { PlanningArea } from "@/lib/master-data";
import { publicHolidays } from "@/lib/holidays";

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
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

type Day = {
  date: string;
  day: number;
  month: number;
  weekday: number;
  isWeekend: boolean;
  holiday?: string;
};

function buildDays(year: number, holidayByDate: Map<string, string>): Day[] {
  const days: Day[] = [];
  const cursor = new Date(Date.UTC(year, 0, 1));
  while (cursor.getUTCFullYear() === year) {
    const m = cursor.getUTCMonth();
    const d = cursor.getUTCDate();
    const date = `${year}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const weekday = cursor.getUTCDay();
    const holiday = holidayByDate.get(date);
    days.push({
      date,
      day: d,
      month: m,
      weekday,
      isWeekend: weekday === 0 || weekday === 5 || weekday === 6,
      ...(holiday ? { holiday } : {}),
    });
    cursor.setUTCDate(d + 1);
  }
  return days;
}

type Category = { name: string; color: string };

function statusClasses(event: EventWithRelations, isHoliday: boolean) {
  if (isHoliday)
    return "bg-muted text-muted-foreground border-y border-border/70 font-semibold uppercase tracking-wide";
  switch (event.status) {
    case "confirmed":
      return "bg-primary/15 text-foreground border border-primary/40";
    case "provisional":
      return "bg-warning/15 text-foreground border border-dashed border-warning/70";
    case "cancelled":
      return "bg-transparent text-muted-foreground/70 border border-border/60 line-through opacity-60";
    default:
      return "bg-muted/40 text-muted-foreground border border-dotted border-border";
  }
}

function statusMark(event: EventWithRelations, isHoliday: boolean) {
  if (isHoliday) return "×";
  switch (event.status) {
    case "confirmed":
      return "●";
    case "provisional":
      return "◐";
    case "cancelled":
      return "✕";
    default:
      return "○";
  }
}

function tooltipText(
  event: EventWithRelations,
  areaNames: string[],
  categoryName: string | undefined,
) {
  const lines = [
    event.title,
    formatDateRange(event.start_date, event.end_date),
    formatTimeRange(event.all_day, event.start_time, event.end_time),
    areaNames.join(", "),
    `Status: ${statusLabel(event.status)}`,
  ];
  if (categoryName) lines.push(categoryName);
  if (event.pax) lines.push(`${event.pax} Pers.`);
  return lines.filter(Boolean).join("\n");
}

export function MatrixView({
  events,
  areas,
  year,
  today,
  categoryById,
  areaNameById,
  jumpMonth,
  onOpenEvent,
  onCreate,
}: {
  events: EventWithRelations[];
  areas: PlanningArea[];
  year: number;
  today: string;
  categoryById: Map<string, { name: string; color: string }>;
  areaNameById: Map<string, string>;
  jumpMonth: { index: number; nonce: number } | null;
  onOpenEvent: (event: EventWithRelations) => void;
  onCreate: (date: string, areaId: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const monthRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const holidayByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const h of publicHolidays(year)) map.set(h.date, h.name);
    return map;
  }, [year]);

  const days = useMemo(() => buildDays(year, holidayByDate), [year, holidayByDate]);

  // date|areaId -> events
  const cellIndex = useMemo(() => {
    const map = new Map<string, EventWithRelations[]>();
    const areaIds = new Set(areas.map((a) => a.id));
    for (const event of events) {
      const start = event.start_date;
      const end = event.end_date ?? event.start_date;
      const from = start < `${year}-01-01` ? `${year}-01-01` : start;
      const to = end > `${year}-12-31` ? `${year}-12-31` : end;
      if (from > to) continue;
      const cursor = new Date(`${from}T00:00:00Z`);
      const last = new Date(`${to}T00:00:00Z`);
      while (cursor.getTime() <= last.getTime()) {
        const date = cursor.toISOString().slice(0, 10);
        for (const areaId of event.planning_area_ids) {
          if (!areaIds.has(areaId)) continue;
          const key = `${date}|${areaId}`;
          const list = map.get(key);
          if (list) list.push(event);
          else map.set(key, [event]);
        }
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }
    return map;
  }, [events, areas, year]);

  useEffect(() => {
    if (!jumpMonth) return;
    monthRefs.current[jumpMonth.index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [jumpMonth]);

  useEffect(() => {
    // reset scroll to top on year change
    scrollRef.current?.scrollTo({ top: 0 });
  }, [year]);

  const gridTemplate = `132px repeat(${areas.length}, minmax(148px, 1fr))`;

  if (!areas.length) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card px-5 py-14 text-center">
        <p className="text-sm font-medium">Keine Planungsbereiche ausgewählt.</p>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="relative max-h-[calc(100vh-15rem)] min-h-[24rem] overflow-auto rounded-md border border-border bg-card"
    >
      <div className="min-w-max" style={{ display: "grid", gridTemplateColumns: gridTemplate }}>
        {/* header */}
        <div className="sticky left-0 top-0 z-30 border-b border-r border-border bg-card px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Datum
        </div>
        {areas.map((area) => (
          <div
            key={area.id}
            className="sticky top-0 z-20 border-b border-r border-border bg-card px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground last:border-r-0"
          >
            {area.name}
          </div>
        ))}

        {days.map((day, dayIndex) => {
          const isMonthStart = day.day === 1;
          const isToday = day.date === today;
          return (
            <MatrixRow
              key={day.date}
              day={day}
              isMonthStart={isMonthStart}
              isToday={isToday}
              areas={areas}
              cellIndex={cellIndex}
              categoryById={categoryById}
              areaNameById={areaNameById}
              columns={areas.length}
              onOpenEvent={onOpenEvent}
              onCreate={onCreate}
              registerMonth={(el) => {
                if (isMonthStart) monthRefs.current[day.month] = el;
              }}
              prevDate={days[dayIndex - 1]?.date ?? null}
              nextDate={days[dayIndex + 1]?.date ?? null}
            />
          );
        })}
      </div>
    </div>
  );
}

function MatrixRow({
  day,
  isMonthStart,
  isToday,
  areas,
  cellIndex,
  categoryById,
  areaNameById,
  columns,
  onOpenEvent,
  onCreate,
  registerMonth,
  prevDate,
  nextDate,
}: {
  day: Day;
  isMonthStart: boolean;
  isToday: boolean;
  areas: PlanningArea[];
  cellIndex: Map<string, EventWithRelations[]>;
  categoryById: Map<string, { name: string; color: string }>;
  areaNameById: Map<string, string>;
  columns: number;
  onOpenEvent: (event: EventWithRelations) => void;
  onCreate: (date: string, areaId: string) => void;
  registerMonth: (el: HTMLDivElement | null) => void;
  prevDate: string | null;
  nextDate: string | null;
}) {
  return (
    <>
      {isMonthStart ? (
        <div
          ref={registerMonth}
          className="col-span-full scroll-mt-8 border-y border-border bg-muted/60 px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-foreground"
          style={{ gridColumn: `1 / span ${columns + 1}` }}
        >
          {MONTHS[day.month]} {day.date.slice(0, 4)}
        </div>
      ) : null}

      <div
        className={cn(
          "sticky left-0 z-10 flex items-center gap-1.5 overflow-hidden whitespace-nowrap border-b border-r border-border px-2 py-0.5 text-[11px] leading-tight tabular-nums",
          day.isWeekend ? "bg-accent/70 font-medium" : "bg-card",
          isToday && "bg-primary/10",
        )}
      >
        <span className={cn("w-5", day.isWeekend ? "text-foreground" : "text-muted-foreground")}>
          {WEEKDAYS[day.weekday]}
        </span>
        <span className={cn(isToday ? "font-semibold text-primary" : "text-foreground")}>
          {String(day.day).padStart(2, "0")} {MONTHS_SHORT[day.month]}
        </span>
        {day.holiday ? (
          <span className="min-w-0 truncate text-[10px] text-muted-foreground/70" title={day.holiday}>
            · {day.holiday}
          </span>
        ) : null}
      </div>

      {areas.map((area) => {
        const list = cellIndex.get(`${day.date}|${area.id}`) ?? [];
        return (
          <MatrixCell
            key={area.id}
            date={day.date}
            areaId={area.id}
            events={list}
            isWeekend={day.isWeekend}
            isToday={isToday}
            categoryById={categoryById}
            areaNameById={areaNameById}
            prevDate={prevDate}
            nextDate={nextDate}
            onOpenEvent={onOpenEvent}
            onCreate={onCreate}
          />
        );
      })}
    </>
  );
}

function MatrixCell({
  date,
  areaId,
  events,
  isWeekend,
  isToday,
  categoryById,
  areaNameById,
  prevDate,
  nextDate,
  onOpenEvent,
  onCreate,
}: {
  date: string;
  areaId: string;
  events: EventWithRelations[];
  isWeekend: boolean;
  isToday: boolean;
  categoryById: Map<string, { name: string; color: string }>;
  areaNameById: Map<string, string>;
  prevDate: string | null;
  nextDate: string | null;
  onOpenEvent: (event: EventWithRelations) => void;
  onCreate: (date: string, areaId: string) => void;
}) {
  const base = cn(
    "relative border-b border-r border-border/70 px-0.5 py-px last:border-r-0",
    isWeekend && "bg-accent/30",
    isToday && "bg-primary/5",
  );

  if (!events.length) {
    return (
      <button
        type="button"
        onClick={() => onCreate(date, areaId)}
        aria-label={`Eintrag am ${date} erstellen`}
        className={cn(base, "min-h-[24px] w-full transition-colors hover:bg-accent/60")}
      />
    );
  }

  const visible = events.slice(0, 2);
  const overflow = events.length - visible.length;

  return (
    <div className={cn(base, "min-h-[24px] space-y-px")}>
      {visible.map((event) => (
        <EventBlock
          key={event.id}
          event={event}
          date={date}
          prevDate={prevDate}
          nextDate={nextDate}
          categoryById={categoryById}
          areaNameById={areaNameById}
          onOpenEvent={onOpenEvent}
        />
      ))}
      {overflow > 0 ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full rounded-[2px] px-1 text-left text-[10px] font-medium text-muted-foreground hover:bg-accent"
            >
              +{overflow}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-1.5">
            <div className="space-y-1">
              {events.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onOpenEvent(event)}
                  className="block w-full truncate rounded-sm px-1.5 py-1 text-left text-xs hover:bg-accent"
                >
                  {event.title}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

function EventBlock({
  event,
  date,
  prevDate,
  nextDate,
  categoryById,
  areaNameById,
  onOpenEvent,
}: {
  event: EventWithRelations;
  date: string;
  prevDate: string | null;
  nextDate: string | null;
  categoryById: Map<string, { name: string; color: string }>;
  areaNameById: Map<string, string>;
  onOpenEvent: (event: EventWithRelations) => void;
}) {
  const end = event.end_date ?? event.start_date;
  const continuesFrom = prevDate !== null && event.start_date <= prevDate && prevDate <= end;
  const continuesTo = nextDate !== null && event.start_date <= nextDate && nextDate <= end;
  const category = categoryById.get(event.category_id);
  const isHoliday = category?.name === HOLIDAY_CATEGORY;
  const areaNames = event.planning_area_ids
    .map((id) => areaNameById.get(id) ?? "")
    .filter(Boolean);

  const time =
    !event.all_day && event.start_time ? event.start_time.slice(0, 5) : null;

  return (
    <button
      type="button"
      onClick={() => onOpenEvent(event)}
      title={tooltipText(event, areaNames, category?.name)}
      className={cn(
        "flex w-full items-center gap-1 overflow-hidden rounded-[3px] px-1 py-[3px] text-left text-[11px] leading-tight transition-colors hover:brightness-95",
        statusClasses(event, isHoliday),
        continuesFrom && "rounded-t-none border-t-0",
        continuesTo && "rounded-b-none border-b-0",
      )}
      style={
        !isHoliday && category?.color
          ? { borderLeft: `3px solid ${category.color}` }
          : undefined
      }
    >
      <span aria-hidden className="text-[8px] opacity-70">
        {statusMark(event, isHoliday)}
      </span>
      {continuesFrom ? (
        <span className="truncate text-[10px] opacity-60">↳ {event.title}</span>
      ) : (
        <span className="truncate">
          {time ? <span className="tabular-nums opacity-70">{time} </span> : null}
          {event.title}
        </span>
      )}
    </button>
  );
}
