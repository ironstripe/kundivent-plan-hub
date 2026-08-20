import { useMemo } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { EventStatusBadge } from "@/components/kundivent/event-status-badge";
import { publicHolidays } from "@/lib/holidays";
import {
  HOLIDAY_CATEGORY,
  formatDateRange,
  formatTimeRange,
  type EventStatus,
  type EventWithRelations,
} from "@/lib/events";
import {
  AREA_STYLE,
  displayAreaKey,
  eventBlockClasses,
  statusMark,
} from "@/lib/area-theme";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const LANE_HEIGHT = 20;
const MAX_LANES = 3;


function iso(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

function parse(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
}

function addDays(date: string, days: number) {
  return iso(new Date(parse(date).getTime() + days * 86400000));
}

/** Weeks (Monday-first) covering the given month. */
function buildWeeks(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = iso(new Date(first.getTime() - offset * 86400000));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const total = Math.ceil((offset + daysInMonth) / 7) * 7;
  const weeks: string[][] = [];
  for (let w = 0; w * 7 < total; w += 1) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)));
  }
  return weeks;
}

type Segment = {
  event: EventWithRelations;
  col: number;
  span: number;
  lane: number;
  continuesFrom: boolean;
  continuesTo: boolean;
};

function statusRank(status: string) {
  return status === "confirmed" ? 0 : status === "provisional" ? 1 : status === "idea" ? 2 : 3;
}

function isHolidayEvent(
  event: EventWithRelations,
  categoryById: Map<string, { name: string; color: string }>,
) {
  return categoryById.get(event.category_id)?.name === HOLIDAY_CATEGORY;
}


export function MonthCalendar({
  year,
  month,
  events,
  today,
  categoryById,
  areaNameById,
  onOpenEvent,
  onCreate,
}: {
  year: number;
  month: number;
  events: EventWithRelations[];
  today: string;
  categoryById: Map<string, { name: string; color: string }>;
  areaNameById: Map<string, string>;
  onOpenEvent: (event: EventWithRelations) => void;
  onCreate: (date: string) => void;
}) {
  const weeks = useMemo(() => buildWeeks(year, month), [year, month]);

  const holidayByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const y of [year - 1, year, year + 1])
      for (const h of publicHolidays(y)) map.set(h.date, h.name);
    return map;
  }, [year]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventWithRelations[]>();
    for (const event of events) {
      const end = event.end_date ?? event.start_date;
      for (let d = event.start_date; d <= end; d = addDays(d, 1)) {
        const list = map.get(d);
        if (list) list.push(event);
        else map.set(d, [event]);
      }
    }
    return map;
  }, [events]);

  const weekLayouts = useMemo(() => {
    return weeks.map((week) => {
      const weekStart = week[0]!;
      const weekEnd = week[6]!;
      const inWeek = events
        .filter((e) => {
          const end = e.end_date ?? e.start_date;
          return e.start_date <= weekEnd && end >= weekStart;
        })
        .sort((a, b) => {
          const aEnd = a.end_date ?? a.start_date;
          const bEnd = b.end_date ?? b.start_date;
          const aLen = (parse(aEnd).getTime() - parse(a.start_date).getTime()) / 86400000;
          const bLen = (parse(bEnd).getTime() - parse(b.start_date).getTime()) / 86400000;
          return (
            a.start_date.localeCompare(b.start_date) ||
            bLen - aLen ||
            statusRank(a.status) - statusRank(b.status) ||
            a.title.localeCompare(b.title)
          );
        });

      const lanes: number[][] = [];
      const segments: Segment[] = [];
      const hiddenByDate = new Map<string, number>();

      for (const event of inWeek) {
        const end = event.end_date ?? event.start_date;
        const col = Math.max(0, week.indexOf(event.start_date < weekStart ? weekStart : event.start_date));
        const endCol = Math.max(0, week.indexOf(end > weekEnd ? weekEnd : end));
        const span = Math.max(1, endCol - col + 1);

        let lane = 0;
        while (lanes[lane]?.some((c) => c >= col && c <= endCol)) lane += 1;
        const cols = Array.from({ length: span }, (_, i) => col + i);
        lanes[lane] = [...(lanes[lane] ?? []), ...cols];

        if (lane < MAX_LANES) {
          segments.push({
            event,
            col,
            span,
            lane,
            continuesFrom: event.start_date < weekStart,
            continuesTo: end > weekEnd,
          });
        } else {
          for (const c of cols) {
            const day = week[c]!;
            hiddenByDate.set(day, (hiddenByDate.get(day) ?? 0) + 1);
          }
        }
      }

      const laneCount = Math.min(lanes.length, MAX_LANES);
      return { week, segments, hiddenByDate, laneCount };
    });
  }, [weeks, events]);

  return (
    <section className="overflow-hidden rounded-md border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/50">
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={cn(
              "px-2 py-1.5 text-[11px] uppercase tracking-wider",
              i >= 4 ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
              i > 0 && "border-l border-border/60",
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {weekLayouts.map(({ week, segments, hiddenByDate, laneCount }) => (
        <div key={week[0]} className="relative min-h-[92px] border-b border-border last:border-b-0">
          <div className="absolute inset-0 grid grid-cols-7">
            {week.map((date, i) => {
              const isOtherMonth = parse(date).getUTCMonth() !== month;
              return (
                <button
                  key={date}
                  type="button"
                  aria-label={`Eintrag am ${date} erstellen`}
                  onClick={() => onCreate(date)}
                  className={cn(
                    "h-full w-full transition-colors hover:bg-accent/40",
                    i > 0 && "border-l border-border/60",
                    i >= 5 && "bg-muted/40",
                    i === 4 && "bg-muted/20",
                    isOtherMonth && "bg-muted/60",
                  )}
                />
              );
            })}
          </div>

          <div className="pointer-events-none relative">
            <div className="grid grid-cols-7">
              {week.map((date) => {
                const isOtherMonth = parse(date).getUTCMonth() !== month;
                const holiday = holidayByDate.get(date);
                return (
                  <div key={date} className="flex items-center gap-1 px-1.5 pb-0.5 pt-1">
                    <span
                      className={cn(
                        "inline-flex size-5 items-center justify-center rounded-full text-[11px] tabular-nums",
                        isOtherMonth ? "text-muted-foreground/50" : "font-medium text-foreground",
                        date === today &&
                          "bg-primary font-semibold text-primary-foreground shadow-none",
                      )}
                    >
                      {Number(date.slice(8, 10))}
                    </span>
                    {holiday ? (
                      <span className="truncate text-[10px] text-muted-foreground/70">
                        {holiday}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <div
              className="relative mx-0.5"
              style={{ height: Math.max(laneCount, 1) * LANE_HEIGHT }}
            >
              {segments.map((seg) => (
                <EventBar
                  key={`${seg.event.id}-${seg.col}`}
                  segment={seg}
                  categoryById={categoryById}
                  areaNameById={areaNameById}
                  onOpenEvent={onOpenEvent}
                />
              ))}
            </div>

            <div className="grid grid-cols-7">
              {week.map((date) => {
                const hidden = hiddenByDate.get(date) ?? 0;
                return (
                  <div key={date} className="px-1 pb-1">
                    {hidden ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="pointer-events-auto rounded-sm px-1 text-[10px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                          >
                            +{hidden} weitere
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-64 p-2">
                          <p className="px-1 pb-1 text-[11px] font-medium text-muted-foreground">
                            {formatDateRange(date, null)}
                          </p>
                          <div className="space-y-1">
                            {(eventsByDate.get(date) ?? []).map((event) => (
                              <button
                                key={event.id}
                                type="button"
                                onClick={() => onOpenEvent(event)}
                                style={
                                  AREA_STYLE[displayAreaKey(event.planning_area_ids, areaNameById)]
                                }
                                className={cn(
                                  "block w-full truncate rounded-[3px] px-1.5 py-1 text-left text-xs",
                                  eventBlockClasses(
                                    event.status as EventStatus,
                                    isHolidayEvent(event, categoryById),
                                  ),
                                )}
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
              })}
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}

function EventBar({
  segment,
  categoryById,
  areaNameById,
  onOpenEvent,
}: {
  segment: Segment;
  categoryById: Map<string, { name: string; color: string }>;
  areaNameById: Map<string, string>;
  onOpenEvent: (event: EventWithRelations) => void;
}) {
  const { event, col, span, lane, continuesFrom, continuesTo } = segment;
  const category = categoryById.get(event.category_id);
  const isHoliday = category?.name === HOLIDAY_CATEGORY;
  const areaNames = event.planning_area_ids.map((id) => areaNameById.get(id) ?? "").filter(Boolean);
  const time = !event.all_day && event.start_time ? event.start_time.slice(0, 5) : null;
  const status = event.status as EventStatus;
  const areaKey = displayAreaKey(event.planning_area_ids, areaNameById);

  return (
    <HoverCard openDelay={200} closeDelay={60}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={() => onOpenEvent(event)}
          className={cn(
            "pointer-events-auto absolute flex items-center gap-1 overflow-hidden rounded-[3px] px-1.5 text-left text-[11px] leading-none",
            eventBlockClasses(status, isHoliday),
            continuesFrom && "rounded-l-none border-l-0",
            continuesTo && "rounded-r-none border-r-0",
          )}
          style={{
            ...AREA_STYLE[areaKey],
            left: `calc(${(col / 7) * 100}% + 2px)`,
            width: `calc(${(span / 7) * 100}% - 4px)`,
            top: lane * LANE_HEIGHT,
            height: LANE_HEIGHT - 3,
          }}
        >
          <span aria-hidden className="shrink-0 text-[7px] opacity-70">
            {statusMark(status, isHoliday)}
          </span>
          {continuesFrom ? <span className="text-[9px] opacity-60">↳</span> : null}
          {time && !continuesFrom ? (
            <span className="shrink-0 tabular-nums opacity-70">{time}</span>
          ) : null}
          <span className="truncate">{event.title}</span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="hidden w-72 p-3 md:block">
        <p className="text-sm font-semibold leading-snug">{event.title}</p>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
          {formatDateRange(event.start_date, event.end_date)} ·{" "}
          {formatTimeRange(event.all_day, event.start_time, event.end_time)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <EventStatusBadge status={status} />
          {category ? (
            <span className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[11px] leading-none text-muted-foreground">
              {category.name}
            </span>
          ) : null}
          {event.pax ? (
            <span className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-[11px] leading-none tabular-nums text-muted-foreground">
              {event.pax} Pers.
            </span>
          ) : null}
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className="mt-[3px] size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: `var(--area-${areaKey})` }}
          />
          {areaNames.join(", ") || "—"}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

