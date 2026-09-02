import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { overlapsDate, type RadarEvent } from "@/lib/radar";
import { RADAR_CHIP_CLASS, RADAR_DOT_CLASS, RELEVANCE_CLASS } from "@/lib/radar/theme";
import type { RadarRelevance, RadarType } from "@/lib/radar/types";
import type { EventWithRelations } from "@/lib/events";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function buildWeeks(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const start = first.getTime() - offset * 86400000;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const total = Math.ceil((offset + daysInMonth) / 7) * 7;
  const weeks: string[][] = [];
  for (let w = 0; w * 7 < total; w += 1) {
    weeks.push(Array.from({ length: 7 }, (_, i) => iso(new Date(start + (w * 7 + i) * 86400000))));
  }
  return weeks;
}

export function RadarMonthView({
  year,
  month,
  radarEvents,
  kundiventEvents,
  showKundivent,
  onSelect,
  onCreate,
}: {
  year: number;
  month: number;
  radarEvents: RadarEvent[];
  kundiventEvents: EventWithRelations[];
  showKundivent: boolean;
  onSelect: (event: RadarEvent) => void;
  onCreate: (date: string) => void;
}) {
  const weeks = useMemo(() => buildWeeks(year, month), [year, month]);

  const byDate = useMemo(() => {
    const map = new Map<string, RadarEvent[]>();
    for (const week of weeks) {
      for (const date of week) {
        map.set(
          date,
          radarEvents.filter((e) => overlapsDate(e, date)),
        );
      }
    }
    return map;
  }, [weeks, radarEvents]);

  const kundiventByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const event of kundiventEvents) {
      const end = event.end_date ?? event.start_date;
      for (let d = new Date(`${event.start_date}T00:00:00Z`); iso(d) <= end; d = new Date(d.getTime() + 86400000)) {
        map.set(iso(d), (map.get(iso(d)) ?? 0) + 1);
      }
    }
    return map;
  }, [kundiventEvents]);

  const today = iso(new Date());

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-1.5 text-[11px] font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0]} className="grid grid-cols-7 border-b border-border last:border-b-0">
          {week.map((date) => {
            const inMonth = Number(date.slice(5, 7)) === month + 1;
            const items = byDate.get(date) ?? [];
            const school = items.filter((e) => e.type === "school_holiday");
            const holidays = items.filter((e) => e.type === "public_holiday");
            const rest = items.filter(
              (e) => e.type === "regional_event" || e.type === "theme_day",
            );
            const kundiventCount = kundiventByDate.get(date) ?? 0;
            return (
              <button
                type="button"
                key={date}
                onDoubleClick={() => onCreate(date)}
                className={cn(
                  "min-h-24 border-r border-border px-1.5 py-1 text-left align-top last:border-r-0",
                  !inMonth && "opacity-45",
                  school.length && "bg-[var(--radar-school-band)]",
                )}
              >
                <div className="mb-1 flex items-center gap-1">
                  <span
                    className={cn(
                      "text-[11px] tabular-nums",
                      date === today
                        ? "rounded-sm bg-primary px-1 font-semibold text-primary-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {Number(date.slice(8, 10))}
                  </span>
                  {holidays.map((h) => (
                    <span
                      key={h.id}
                      title={`${h.title} (${h.canton})`}
                      className={cn("size-1.5 rounded-full", RADAR_DOT_CLASS.public_holiday)}
                    />
                  ))}
                  {showKundivent && kundiventCount ? (
                    <span className="ml-auto rounded-sm bg-secondary px-1 text-[10px] font-medium text-secondary-foreground">
                      {kundiventCount}
                    </span>
                  ) : null}
                </div>

                <div className="space-y-0.5">
                  {/* Only label the band where it starts or a week begins. */}
                  {school
                    .filter((s) => s.start_date === date || week[0] === date)
                    .map((s) => (
                      <span
                        key={s.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(s);
                        }}
                        className="block truncate rounded-sm px-1 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {s.title}
                      </span>
                    ))}
                  {rest.slice(0, 3).map((item) => (
                    <span
                      key={item.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(item);
                      }}
                      className={cn(
                        "block truncate rounded-sm px-1 py-0.5 text-[10px] leading-tight",
                        RADAR_CHIP_CLASS[item.type as RadarType],
                        RELEVANCE_CLASS[(item.relevance as RadarRelevance) ?? "medium"],
                      )}
                    >
                      {item.title}
                    </span>
                  ))}
                  {rest.length > 3 ? (
                    <span className="block px-1 text-[10px] text-muted-foreground">
                      +{rest.length - 3} weitere
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
