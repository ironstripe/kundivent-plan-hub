import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { overlapsDate, type RadarEvent } from "@/lib/radar";
import { RADAR_DOT_CLASS } from "@/lib/radar/theme";
import type { RadarType } from "@/lib/radar/types";
import type { EventWithRelations } from "@/lib/events";

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
  return d.toISOString().slice(0, 10);
}

/** Compact 12-month density overview: bands for holidays, dots for events. */
export function RadarYearView({
  year,
  radarEvents,
  kundiventEvents,
  showKundivent,
  onSelectMonth,
}: {
  year: number;
  radarEvents: RadarEvent[];
  kundiventEvents: EventWithRelations[];
  showKundivent: boolean;
  onSelectMonth: (month: number) => void;
}) {
  const kundiventDays = useMemo(() => {
    const set = new Set<string>();
    for (const event of kundiventEvents) {
      const end = event.end_date ?? event.start_date;
      for (
        let d = new Date(`${event.start_date}T00:00:00Z`);
        iso(d) <= end;
        d = new Date(d.getTime() + 86400000)
      ) {
        set.add(iso(d));
      }
    }
    return set;
  }, [kundiventEvents]);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {MONTHS.map((label, month) => {
        const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        const dates = Array.from(
          { length: days },
          (_, i) => `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`,
        );
        return (
          <button
            key={label}
            type="button"
            onClick={() => onSelectMonth(month)}
            className="rounded-md border border-border bg-card p-3 text-left transition-colors hover:border-primary/40"
          >
            <p className="mb-2 text-xs font-semibold">{label}</p>
            <div className="grid grid-cols-[repeat(31,1fr)] gap-px">
              {dates.map((date) => {
                const items = radarEvents.filter((e) => overlapsDate(e, date));
                const school = items.some((e) => e.type === "school_holiday");
                const holiday = items.some((e) => e.type === "public_holiday");
                const marker = items.find(
                  (e) => e.type === "regional_event" || e.type === "theme_day",
                );
                return (
                  <span
                    key={date}
                    title={`${date.slice(8, 10)}.${date.slice(5, 7)}. – ${items.length} Radar-Einträge`}
                    className={cn(
                      "flex h-6 items-end justify-center rounded-[1px]",
                      school ? "bg-[var(--radar-school-band-strong)]" : "bg-muted/50",
                      holiday && "ring-1 ring-radar-holiday ring-inset",
                    )}
                  >
                    {marker ? (
                      <span
                        className={cn(
                          "mb-0.5 size-1 rounded-full",
                          RADAR_DOT_CLASS[marker.type as RadarType],
                        )}
                      />
                    ) : null}
                    {showKundivent && kundiventDays.has(date) ? (
                      <span className="mb-0.5 ml-px size-1 rounded-full bg-primary" />
                    ) : null}
                  </span>
                );
              })}
            </div>
          </button>
        );
      })}
    </div>
  );
}
