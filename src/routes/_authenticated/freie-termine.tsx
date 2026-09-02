import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronDown, CircleAlert, CircleSlash, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { usePlanningAreas, useCategories } from "@/lib/master-data";
import { EventDrawer } from "@/components/kundivent/event-drawer";
import { EventStatusBadge } from "@/components/kundivent/event-status-badge";
import { formatDateRange, formatTimeRange, type EventWithRelations } from "@/lib/events";
import {
  AVAILABILITY_LABEL,
  buildAvailabilityIndex,
  calculateAvailability,
  eachDate,
  isoWeekday,
  useEventsInRange,
  type AvailabilityState,
  type DayAvailability,
} from "@/lib/availability";

const WEEKDAYS = [
  { value: 1, short: "Mo", label: "Montag" },
  { value: 2, short: "Di", label: "Dienstag" },
  { value: 3, short: "Mi", label: "Mittwoch" },
  { value: 4, short: "Do", label: "Donnerstag" },
  { value: 5, short: "Fr", label: "Freitag" },
  { value: 6, short: "Sa", label: "Samstag" },
  { value: 7, short: "So", label: "Sonntag" },
];

const DEFAULT_AREA_NAMES = ["Event / Pavillon", "Restaurant / À la Carte"];

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

/**
 * Availability keeps its own semantic colour system (--avail-*), deliberately
 * separate from the planning-area colours used in Übersicht and Matrix.
 * Each state is also carried by an icon and a text label, never colour alone.
 */
const STATE_STYLE: Record<
  AvailabilityState,
  { cell: string; label: string; Icon: typeof Check }
> = {
  free: {
    cell: "border-[var(--avail-free-border)] bg-[var(--avail-free-bg)] hover:bg-[var(--avail-free-hover)]",
    label: "text-[var(--avail-free)]",
    Icon: Check,
  },
  provisional: {
    cell: "border-dashed border-[var(--avail-provisional-border)] bg-[var(--avail-provisional-bg)] hover:bg-[var(--avail-provisional-hover)]",
    label: "text-[var(--avail-provisional)]",
    Icon: CircleAlert,
  },
  occupied: {
    cell: "border-[var(--avail-occupied-border)] bg-[var(--avail-occupied-bg)] hover:bg-[var(--avail-occupied-hover)]",
    label: "text-foreground",
    Icon: Lock,
  },
  closed: {
    cell: "surface-hatch border-[var(--avail-closed-border)] bg-[var(--avail-closed-bg)] hover:bg-[var(--avail-closed-hover)]",
    label: "text-muted-foreground",
    Icon: CircleSlash,
  },
};


function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addMonths(date: string, months: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return iso(d);
}

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/** Monday of the ISO week containing date. */
function weekStart(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - (isoWeekday(date) - 1));
  return iso(d);
}

function dayNumber(date: string) {
  return date.slice(8, 10);
}

function longDate(date: string) {
  const wd = WEEKDAYS[isoWeekday(date) - 1]!.label;
  const [y, m, d] = date.split("-");
  return `${wd}, ${Number(d)}. ${MONTHS[Number(m) - 1]} ${y}`;
}

function FreieTermine() {
  const today = iso(new Date());
  const areas = usePlanningAreas();
  const categories = useCategories();

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addMonths(today, 6));
  const [weekdays, setWeekdays] = useState<number[]>([5, 6, 7]);
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[] | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EventWithRelations | null>(null);
  const [newDate, setNewDate] = useState<string>("");

  const activeAreas = useMemo(
    () => (areas.data ?? []).filter((a) => a.active),
    [areas.data],
  );

  const areaIds = useMemo(() => {
    if (selectedAreaIds) return selectedAreaIds;
    const defaults = activeAreas
      .filter((a) => DEFAULT_AREA_NAMES.includes(a.name))
      .map((a) => a.id);
    return defaults;
  }, [selectedAreaIds, activeAreas]);

  const areaName = (id: string) => activeAreas.find((a) => a.id === id)?.name ?? "—";

  const rangeValid = from <= to;
  const events = useEventsInRange(from, rangeValid ? to : from);

  const index = useMemo(
    () => buildAvailabilityIndex(events.data ?? [], categories.data ?? []),
    [events.data, categories.data],
  );

  const days = useMemo<DayAvailability[]>(() => {
    if (!rangeValid || areaIds.length === 0) return [];
    return eachDate(from, to)
      .filter((d) => weekdays.includes(isoWeekday(d)))
      .map((d) => calculateAvailability(d, areaIds, index));
  }, [from, to, weekdays, areaIds, index, rangeValid]);

  const months = useMemo(() => {
    const map = new Map<string, Map<string, DayAvailability[]>>();
    for (const day of days) {
      const mk = monthKey(day.date);
      let weeks = map.get(mk);
      if (!weeks) {
        weeks = new Map();
        map.set(mk, weeks);
      }
      const wk = weekStart(day.date);
      const list = weeks.get(wk);
      if (list) list.push(day);
      else weeks.set(wk, [day]);
    }
    return [...map.entries()];
  }, [days]);

  const freeCount = days.filter((d) => d.state === "free").length;

  function toggleWeekday(value: number) {
    setWeekdays((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value].sort(),
    );
  }

  function toggleArea(id: string) {
    const current = areaIds;
    setSelectedAreaIds(
      current.includes(id) ? current.filter((a) => a !== id) : [...current, id],
    );
  }

  function openFree(date: string) {
    setEditEvent(null);
    setNewDate(date);
    setDrawerOpen(true);
  }

  function openEvent(event: EventWithRelations) {
    setEditEvent(event);
    setNewDate("");
    setDrawerOpen(true);
  }

  const sortedWeekdays = [...weekdays].sort((a, b) => a - b);

  return (
    <div className="w-full space-y-3">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-base font-semibold tracking-tight">Freie Termine</h1>
        <p className="text-xs text-muted-foreground">
          {rangeValid && areaIds.length > 0
            ? `${freeCount} freie Termine · ${days.length} geprüfte Daten`
            : "Bitte Zeitraum und Planungsbereiche wählen"}
        </p>
      </header>

      <div className="sticky top-12 z-10 rounded-md border border-border bg-card/95 p-2.5 backdrop-blur">

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="from" className="text-[11px] text-muted-foreground">
              Von
            </Label>
            <Input
              id="from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-8 w-[150px] text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to" className="text-[11px] text-muted-foreground">
              Bis
            </Label>
            <Input
              id="to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-8 w-[150px] text-xs"
            />
          </div>

          <div className="space-y-1">
            <span className="block text-[11px] text-muted-foreground">Wochentage</span>
            <div className="flex gap-1">
              {WEEKDAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  aria-pressed={weekdays.includes(day.value)}
                  title={day.label}
                  onClick={() => toggleWeekday(day.value)}
                  className={cn(
                    "h-8 w-9 rounded-sm border text-[11px] font-medium transition-colors",
                    weekdays.includes(day.value)
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-accent",
                  )}
                >
                  {day.short}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <span className="block text-[11px] text-muted-foreground">Planungsbereiche</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
                  {areaIds.length === 0
                    ? "Wählen…"
                    : areaIds.length === 1
                      ? areaName(areaIds[0]!)
                      : `${areaIds.length} Bereiche`}
                  <ChevronDown className="size-3.5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-1">
                {activeAreas.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => toggleArea(area.id)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent"
                  >
                    <span
                      className={cn(
                        "flex size-4 items-center justify-center rounded-[3px] border",
                        areaIds.includes(area.id)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border",
                      )}
                    >
                      {areaIds.includes(area.id) && <Check className="size-3" />}
                    </span>
                    {area.name}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {(["free", "provisional", "occupied", "closed"] as AvailabilityState[]).map((s) => {
            const { Icon, cell } = STATE_STYLE[s];
            return (
              <span key={s} className="inline-flex items-center gap-1">
                <span
                  className={cn("inline-flex size-4 items-center justify-center rounded-[3px] border", cell)}
                >
                  <Icon className="size-2.5" />
                </span>
                {AVAILABILITY_LABEL[s]}
              </span>
            );
          })}
        </div>
      </div>

      {!rangeValid ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Das Enddatum liegt vor dem Startdatum.
        </p>
      ) : areaIds.length === 0 ? (
        <p className="rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Bitte mindestens einen Planungsbereich wählen.
        </p>
      ) : events.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : events.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="mb-2 text-destructive">Verfügbarkeit konnte nicht geladen werden.</p>
          <Button size="sm" variant="outline" onClick={() => events.refetch()}>
            Erneut versuchen
          </Button>
        </div>
      ) : weekdays.length === 0 ? (
        <p className="rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Keine Wochentage ausgewählt – bitte mindestens einen Wochentag wählen.
        </p>
      ) : days.length === 0 ? (
        <p className="rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Im gewählten Zeitraum gibt es keine Daten mit den gewählten Wochentagen.
        </p>
      ) : (
        <div className="space-y-5">
          {months.map(([mk, weeks]) => (
            <section key={mk}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {monthLabel(mk)}
              </h2>
              <div className="space-y-1.5">
                {[...weeks.entries()].map(([wk, weekDays]) => (
                  <div
                    key={wk}
                    className="grid gap-1.5"
                    style={{
                      gridTemplateColumns: `repeat(${sortedWeekdays.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {sortedWeekdays.map((wd) => {
                      const day = weekDays.find((d) => isoWeekday(d.date) === wd);
                      if (!day)
                        return (
                          <div
                            key={wd}
                            className="min-h-[52px] rounded-sm border border-dashed border-border/50"
                          />
                        );
                      return (
                        <DayCell
                          key={day.date}
                          day={day}
                          areaName={areaName}
                          onCreate={() => openFree(day.date)}
                          onOpenEvent={openEvent}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <EventDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        event={editEvent}
        {...(editEvent
          ? {}
          : {
              defaultDate: newDate,
              defaultAreaIds: areaIds,
              defaultStatus: "provisional" as const,
            })}
      />
    </div>
  );
}

function DayCell({
  day,
  areaName,
  onCreate,
  onOpenEvent,
}: {
  day: DayAvailability;
  areaName: (id: string) => string;
  onCreate: () => void;
  onOpenEvent: (event: EventWithRelations) => void;
}) {
  const style = STATE_STYLE[day.state];
  const Icon = style.Icon;
  const wd = WEEKDAYS[isoWeekday(day.date) - 1]!.short;

  const trigger = (
    <button
      type="button"
      onClick={day.state === "free" ? onCreate : undefined}
      className={cn(
        "flex min-h-[52px] w-full flex-col items-start gap-0.5 rounded-sm border px-2 py-1.5 text-left transition-colors",
        style.cell,
      )}
    >
      <span className="text-[11px] font-medium text-muted-foreground">
        {wd} {dayNumber(day.date)}
      </span>
      <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide", style.label)}>
        <Icon className="size-3" />
        {AVAILABILITY_LABEL[day.state]}
      </span>
    </button>
  );

  if (day.state === "free") return trigger;

  return (
    <Popover>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3 text-xs">
        <p className="text-sm font-semibold">{longDate(day.date)}</p>
        <p className={cn("mb-2 text-[11px] font-semibold uppercase tracking-wide", style.label)}>
          {AVAILABILITY_LABEL[day.state]}
        </p>

        <div className="mb-3 space-y-1 rounded-sm border border-border bg-muted/30 p-2">
          {day.areas.map((area) => (
            <div key={area.areaId} className="flex items-center justify-between gap-2">
              <span className="truncate text-muted-foreground">{areaName(area.areaId)}</span>
              <span className={cn("font-medium", STATE_STYLE[area.state].label)}>
                {AVAILABILITY_LABEL[area.state]}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {day.blockingEvents.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => onOpenEvent(event)}
              className="w-full rounded-sm border border-border px-2 py-1.5 text-left hover:bg-accent"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{event.title}</span>
                <EventStatusBadge status={event.status} />
              </div>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {event.planning_area_ids.map(areaName).join(" + ")}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatDateRange(event.start_date, event.end_date)} ·{" "}
                {formatTimeRange(event.all_day, event.start_time, event.end_time)}
                {event.pax ? ` · ${event.pax} Personen` : ""}
              </p>
            </button>
          ))}
        </div>

        {canEdit ? (
          <Button
            size="sm"
            variant="outline"
            className="mt-3 h-7 w-full gap-1 text-xs"
            onClick={onCreate}
          >
            <Plus className="size-3" /> Trotzdem Eintrag erfassen
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export const Route = createFileRoute("/_authenticated/freie-termine")({
  head: () => ({
    meta: [
      { title: "Freie Termine – Kundivent" },
      {
        name: "description",
        content:
          "Verfügbarkeit pro Planungsbereich prüfen und freie Wochenend-Termine für Event-Anfragen finden.",
      },
      { property: "og:title", content: "Freie Termine – Kundivent" },
      {
        property: "og:description",
        content:
          "Verfügbarkeit pro Planungsbereich prüfen und freie Wochenend-Termine für Event-Anfragen finden.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FreieTermine,
});
