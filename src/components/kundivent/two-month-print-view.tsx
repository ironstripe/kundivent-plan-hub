import { useMemo } from "react";
import { AREA_STYLE, displayAreaKey, statusMark } from "@/lib/area-theme";
import {
  HOLIDAY_CATEGORY,
  type EventStatus,
  type EventWithRelations,
} from "@/lib/events";
import { cn } from "@/lib/utils";

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

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function iso(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

function parse(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

function addDays(date: string, days: number) {
  return iso(new Date(parse(date).getTime() + days * 86_400_000));
}

function buildWeeks(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = iso(new Date(first.getTime() - offset * 86_400_000));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const dayCount = Math.ceil((offset + daysInMonth) / 7) * 7;

  return Array.from({ length: dayCount / 7 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day)),
  );
}

function monthAfter(year: number, month: number) {
  return month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };
}

function rangeLabel(year: number, month: number, nextYear: number, nextMonth: number) {
  if (year === nextYear) return `${MONTHS[month]} – ${MONTHS[nextMonth]} ${year}`;
  return `${MONTHS[month]} ${year} – ${MONTHS[nextMonth]} ${nextYear}`;
}

function createdLabel(today: string) {
  const [year, month, day] = today.split("-");
  return `${day}.${month}.${year}`;
}

export function TwoMonthPrintView({
  year,
  month,
  today,
  events,
  categoryById,
  areaNameById,
}: {
  year: number;
  month: number;
  today: string;
  events: EventWithRelations[];
  categoryById: Map<string, { name: string; color: string }>;
  areaNameById: Map<string, string>;
}) {
  const next = monthAfter(year, month);

  return (
    <section className="kundivent-print-root" aria-label="Druckansicht zweier Monate">
      <header className="print-overview-header">
        <h1>Kundivent · {rangeLabel(year, month, next.year, next.month)}</h1>
        <p>Erstellt am {createdLabel(today)}</p>
      </header>
      <div className="print-months">
        <PrintMonth
          year={year}
          month={month}
          events={events}
          categoryById={categoryById}
          areaNameById={areaNameById}
        />
        <PrintMonth
          year={next.year}
          month={next.month}
          events={events}
          categoryById={categoryById}
          areaNameById={areaNameById}
        />
      </div>
    </section>
  );
}

function PrintMonth({
  year,
  month,
  events,
  categoryById,
  areaNameById,
}: {
  year: number;
  month: number;
  events: EventWithRelations[];
  categoryById: Map<string, { name: string; color: string }>;
  areaNameById: Map<string, string>;
}) {
  const weeks = useMemo(() => buildWeeks(year, month), [year, month]);
  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventWithRelations[]>();
    const monthStart = iso(new Date(Date.UTC(year, month, 1)));
    const monthEnd = iso(new Date(Date.UTC(year, month + 1, 0)));

    for (const event of events) {
      const eventEnd = event.end_date ?? event.start_date;
      const from = event.start_date < monthStart ? monthStart : event.start_date;
      const to = eventEnd > monthEnd ? monthEnd : eventEnd;
      if (from > to) continue;
      for (let date = from; date <= to; date = addDays(date, 1)) {
        const list = map.get(date);
        if (list) list.push(event);
        else map.set(date, [event]);
      }
    }

    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          (a.start_time ?? "").localeCompare(b.start_time ?? "") || a.title.localeCompare(b.title),
      );
    }
    return map;
  }, [events, month, year]);

  return (
    <article className="print-month">
      <h2>{MONTHS[month]} {year}</h2>
      <div className="print-weekdays">
        {WEEKDAYS.map((weekday, index) => (
          <div key={weekday} className={cn(index >= 4 && "print-weekend")}>{weekday}</div>
        ))}
      </div>
      <div className="print-weeks">
        {weeks.map((week) => (
          <div key={week[0]} className="print-week">
            {week.map((date, index) => {
              const inMonth = parse(date).getUTCMonth() === month;
              return (
                <div
                  key={date}
                  className={cn(
                    "print-day",
                    index >= 4 && "print-weekend",
                    !inMonth && "print-adjacent-day",
                  )}
                >
                  <span className="print-day-number">{Number(date.slice(8, 10))}</span>
                  {inMonth ? (
                    <div className="print-events">
                      {(eventsByDate.get(date) ?? []).map((event) => (
                        <PrintEvent
                          key={event.id}
                          event={event}
                          categoryById={categoryById}
                          areaNameById={areaNameById}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </article>
  );
}

function PrintEvent({
  event,
  categoryById,
  areaNameById,
}: {
  event: EventWithRelations;
  categoryById: Map<string, { name: string; color: string }>;
  areaNameById: Map<string, string>;
}) {
  const status = event.status as EventStatus;
  const isHoliday = categoryById.get(event.category_id)?.name === HOLIDAY_CATEGORY;
  const areaKey = displayAreaKey(event.planning_area_ids, areaNameById);
  const time = !event.all_day && event.start_time ? event.start_time.slice(0, 5) : null;

  return (
    <div
      className={cn(
        "print-event",
        `print-event-${isHoliday ? "holiday" : status}`,
      )}
      style={AREA_STYLE[areaKey]}
    >
      <span className="print-status-mark" aria-hidden>{statusMark(status, isHoliday)}</span>
      {time ? <span className="print-event-time">{time}</span> : null}
      <span className="print-event-title">{event.title}</span>
    </div>
  );
}