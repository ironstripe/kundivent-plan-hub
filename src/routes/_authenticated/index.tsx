import { useCallback, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EventDrawer } from "@/components/kundivent/event-drawer";
import { usePermissions } from "@/lib/permissions";
import { MonthCalendar } from "@/components/kundivent/month-calendar";
import { MatrixView } from "@/components/kundivent/matrix-view";
import { YearOverview } from "@/components/kundivent/year-overview";
import { useCategories, usePlanningAreas } from "@/lib/master-data";
import { EVENT_STATUSES, useEvents, type EventWithRelations } from "@/lib/events";
import {
  AVAILABILITY_LABEL,
  buildAvailabilityIndex,
  calculateAvailability,
  eachDate,
  type AvailabilityState,
  type DayAvailability,
} from "@/lib/availability";
import { areaKeyFromName } from "@/lib/area-theme";
import { cn } from "@/lib/utils";

type Mode = "kalender" | "jahr" | "verfuegbarkeit" | "matrix";

const MODES: Mode[] = ["kalender", "jahr", "verfuegbarkeit", "matrix"];

export const Route = createFileRoute("/_authenticated/")({
  validateSearch: (search: Record<string, unknown>) => {
    const mode = MODES.includes(search['mode'] as Mode) ? (search['mode'] as Mode) : undefined;
    const y = Number(search['y']);
    const m = Number(search['m']);
    return {
      ...(mode ? { mode } : {}),
      ...(Number.isInteger(y) && y > 1900 ? { y } : {}),
      ...(Number.isInteger(m) && m >= 0 && m <= 11 ? { m } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Kalender – Kundivent" },
      {
        name: "description",
        content:
          "Monatskalender mit allen Events, Belegungen und Betriebsferien der Kundelfingerhof AG.",
      },
      { property: "og:title", content: "Kalender – Kundivent" },
      {
        property: "og:description",
        content:
          "Monatskalender mit allen Events, Belegungen und Betriebsferien der Kundelfingerhof AG.",
      },
    ],
  }),
  component: Uebersicht,
});

const ALL = "all";

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

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function Uebersicht() {
  const { canEdit } = usePermissions();
  const events = useEvents();
  const areas = usePlanningAreas();
  const categories = useCategories();

  const today = todayIso();
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7)) - 1;

  const urlSearch = Route.useSearch();
  const navigate = Route.useNavigate();
  const mode: Mode = urlSearch.mode ?? "kalender";
  const cursor = {
    year: urlSearch.y ?? currentYear,
    month: urlSearch.m ?? currentMonth,
  };

  function patchSearch(patch: { mode?: Mode; y?: number; m?: number }) {
    navigate({ to: ".", replace: true, search: (prev) => ({ ...prev, ...patch }) });
  }

  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [search, setSearch] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<EventWithRelations | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);
  const [prefillAreas, setPrefillAreas] = useState<string[]>([]);
  const [prefillStatus, setPrefillStatus] = useState<"provisional" | undefined>(undefined);
  const [jumpMonth, setJumpMonth] = useState<{ index: number; nonce: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState<number | null>(null);
  const [areaPopoverOpen, setAreaPopoverOpen] = useState(false);

  const activeAreas = useMemo(() => (areas.data ?? []).filter((a) => a.active), [areas.data]);
  const activeCategories = useMemo(
    () => (categories.data ?? []).filter((c) => c.active),
    [categories.data],
  );

  const areaNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of areas.data ?? []) map.set(a.id, a.name);
    return map;
  }, [areas.data]);

  const categoryById = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const c of categories.data ?? []) map.set(c.id, { name: c.name, color: c.color });
    return map;
  }, [categories.data]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (events.data ?? []).filter((event) => {
      if (!showCancelled && event.status === "cancelled" && status !== "cancelled") return false;
      if (areaIds.length && !event.planning_area_ids.some((id) => areaIds.includes(id)))
        return false;
      if (categoryId !== ALL && event.category_id !== categoryId) return false;
      if (status !== ALL && event.status !== status) return false;
      if (term && !`${event.title} ${event.notes ?? ""}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [events.data, areaIds, categoryId, status, search, showCancelled]);

  const matrixEvents = useMemo(
    () =>
      filteredEvents.filter((event) => {
        const start = Number(event.start_date.slice(0, 4));
        const end = Number((event.end_date ?? event.start_date).slice(0, 4));
        return start <= cursor.year && end >= cursor.year;
      }),
    [filteredEvents, cursor.year],
  );

  const matrixAreas = useMemo(
    () => (areaIds.length ? activeAreas.filter((a) => areaIds.includes(a.id)) : activeAreas),
    [activeAreas, areaIds],
  );

  const secondaryCount =
    (categoryId !== ALL ? 1 : 0) + (status !== ALL ? 1 : 0) + (search.trim() ? 1 : 0);

  const areaLabel = areaIds.length
    ? areaIds.length === 1
      ? (areaNameById.get(areaIds[0]!) ?? "1 Bereich")
      : `${areaIds.length} Bereiche`
    : "Alle Bereiche";

  /** Availability is derived from all events (filters are a display concern). */
  const availabilityIndex = useMemo(
    () => buildAvailabilityIndex(events.data ?? [], categories.data ?? []),
    [events.data, categories.data],
  );

  const availabilityAreaIds = useMemo(
    () => (areaIds.length ? areaIds : activeAreas.map((a) => a.id)),
    [areaIds, activeAreas],
  );

  const availabilityStates = useMemo(() => {
    if (mode !== "verfuegbarkeit" || availabilityAreaIds.length === 0) return null;
    const first = new Date(Date.UTC(cursor.year, cursor.month, 1));
    const last = new Date(Date.UTC(cursor.year, cursor.month + 1, 0));
    const from = new Date(first.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const to = new Date(last.getTime() + 7 * 86400000).toISOString().slice(0, 10);
    const map = new Map<string, DayAvailability>();
    for (const date of eachDate(from, to))
      map.set(date, calculateAvailability(date, availabilityAreaIds, availabilityIndex));
    return map;
  }, [mode, cursor.year, cursor.month, availabilityAreaIds, availabilityIndex]);

  const freeCount = useMemo(() => {
    if (!availabilityStates) return 0;
    let count = 0;
    for (const [date, day] of availabilityStates) {
      if (Number(date.slice(5, 7)) - 1 !== cursor.month) continue;
      const wd = new Date(`${date}T00:00:00Z`).getUTCDay() || 7;
      if (weekdays.length && !weekdays.includes(wd)) continue;
      if (day.state === "free") count += 1;
    }
    return count;
  }, [availabilityStates, cursor.month, weekdays]);

  function shiftMonth(delta: number) {
    const next = cursor.month + delta;
    const year = cursor.year + Math.floor(next / 12);
    const month = ((next % 12) + 12) % 12;
    if (mode === "matrix") setJumpMonth({ index: month, nonce: Date.now() });
    patchSearch({ y: year, m: month });
  }

  function shiftYear(delta: number) {
    patchSearch({ y: cursor.year + delta });
  }

  function goToday() {
    if (mode === "matrix") setJumpMonth({ index: currentMonth, nonce: Date.now() });
    patchSearch({ y: currentYear, m: currentMonth });
  }

  function goToMonth(year: number, month: number) {
    if (mode === "matrix") setJumpMonth({ index: month, nonce: Date.now() });
    patchSearch({ y: year, m: month });
  }

  function switchMode(next: Mode) {
    if (next === "matrix") setJumpMonth({ index: cursor.month, nonce: Date.now() });
    patchSearch({ mode: next });
  }

  /** Matrix scrolls through a whole year — keep the header month in sync. */
  const handleVisibleMonth = useCallback(
    (month: number) => {
      navigate({
        to: ".",
        replace: true,
        search: (prev) => (prev.m === month ? prev : { ...prev, m: month }),
      });
    },
    [navigate],
  );


  function openEvent(event: EventWithRelations) {
    setPrefillDate(null);
    setPrefillAreas([]);
    setPrefillStatus(undefined);
    setSelected(event);
    setDrawerOpen(true);
  }

  function openNew(date?: string, areaId?: string) {
    setPrefillDate(date ?? null);
    setPrefillAreas(areaId ? [areaId] : areaIds.length === 1 ? [areaIds[0]!] : []);
    setPrefillStatus(undefined);
    setSelected(null);
    setDrawerOpen(true);
  }

  /** Verfügbarkeit: clicking a free date pre-books it provisionally. */
  function openFreeDate(date: string) {
    setPrefillDate(date);
    setPrefillAreas(areaIds.length ? areaIds : []);
    setPrefillStatus("provisional");
    setSelected(null);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={mode === "jahr" ? "Vorheriges Jahr" : "Vorheriger Monat"}
            onClick={() => (mode === "jahr" ? shiftYear(-1) : shiftMonth(-1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Popover
            open={pickerOpen}
            onOpenChange={(open) => {
              setPickerOpen(open);
              if (open) setPickerYear(cursor.year);
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                className="h-8 min-w-[150px] gap-1 px-2 text-sm font-semibold tracking-tight tabular-nums"
                aria-label="Monat und Jahr wählen"
              >
                <h1 className="text-sm font-semibold">
                  {mode === "jahr" ? cursor.year : `${MONTHS[cursor.month]} ${cursor.year}`}
                </h1>
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 space-y-2 p-2">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Vorheriges Jahr"
                  onClick={() => setPickerYear((y) => (y ?? cursor.year) - 1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <Select
                  value={String(pickerYear ?? cursor.year)}
                  onValueChange={(v) => setPickerYear(Number(v))}
                >
                  <SelectTrigger className="h-7 flex-1 text-xs tabular-nums">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 11 }, (_, i) => currentYear - 5 + i).map((y) => (
                      <SelectItem key={y} value={String(y)} className="text-xs tabular-nums">
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Nächstes Jahr"
                  onClick={() => setPickerYear((y) => (y ?? cursor.year) + 1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {MONTHS.map((label, index) => {
                  const year = pickerYear ?? cursor.year;
                  const active = index === cursor.month && year === cursor.year;
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        if (mode === "jahr") patchSearch({ mode: "kalender", y: year, m: index });
                        else goToMonth(year, index);
                        setPickerOpen(false);
                      }}
                      className={cn(
                        "rounded-sm px-1 py-1.5 text-[11px] font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      {label.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={mode === "jahr" ? "Nächstes Jahr" : "Nächster Monat"}
            onClick={() => (mode === "jahr" ? shiftYear(1) : shiftMonth(1))}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" size="sm" className="ml-1 h-8 px-2.5 text-xs" onClick={goToday}>
            Heute
          </Button>
        </div>

        <div
          className="ml-1 inline-flex items-center rounded-sm bg-muted p-0.5"
          role="group"
          aria-label="Ansicht"
        >
          {(
            [
              ["kalender", "Monat"],
              ["jahr", "Jahr"],
              ["verfuegbarkeit", "Verfügbarkeit"],
              ["matrix", "Matrix"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => switchMode(value)}
              className={cn(
                "rounded-[3px] px-2.5 py-1 text-xs transition-colors",
                mode === value
                  ? "bg-card font-semibold text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "verfuegbarkeit" ? (
          <div className="flex items-center gap-1" role="group" aria-label="Wochentage">
            {(
              [
                [1, "Mo"],
                [2, "Di"],
                [3, "Mi"],
                [4, "Do"],
                [5, "Fr"],
                [6, "Sa"],
                [7, "So"],
              ] as const
            ).map(([value, label]) => {
              const on = weekdays.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setWeekdays((prev) =>
                      on ? prev.filter((d) => d !== value) : [...prev, value].sort(),
                    )
                  }
                  className={cn(
                    "h-8 w-8 rounded-sm border text-[11px] font-medium transition-colors",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-accent",
                  )}
                >
                  {label}
                </button>
              );
            })}
            <span className="ml-1 text-[11px] text-muted-foreground">
              {freeCount} {AVAILABILITY_LABEL["free" as AvailabilityState].toLowerCase()}
            </span>
          </div>
        ) : null}


        <div className="ml-auto flex items-center gap-2">
          <Popover open={areaPopoverOpen} onOpenChange={setAreaPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 gap-1.5 text-xs",
                  areaIds.length > 0 && "border-primary/50 bg-primary/5 font-medium",
                )}
              >
                {areaLabel}
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-2">
              <button
                type="button"
                onClick={() => setAreaIds([])}
                className={cn(
                  "mb-1 block w-full rounded-sm px-1.5 py-1 text-left text-xs hover:bg-accent",
                  areaIds.length === 0 && "font-medium",
                )}
              >
                Alle Bereiche
              </button>
              <div className="space-y-0.5 border-t border-border pt-1">
                {activeAreas.map((area) => {
                  const checked = areaIds.includes(area.id);
                  return (
                    <label
                      key={area.id}
                      className="flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 text-xs hover:bg-accent"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          setAreaIds((prev) =>
                            checked ? prev.filter((id) => id !== area.id) : [...prev, area.id],
                          )
                        }
                      />
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: `var(--area-${areaKeyFromName(area.name)})` }}
                      />
                      {area.name}
                    </label>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center justify-end border-t border-border pt-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={() => setAreaPopoverOpen(false)}
                >
                  Fertig
                </Button>
              </div>
            </PopoverContent>
          </Popover>


          {mode === "jahr" ? null : (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 gap-1.5 text-xs",
                  (secondaryCount > 0 || showCancelled) &&
                    "border-primary/50 bg-primary/5 font-medium",
                )}
                aria-label="Weitere Filter"

              >
                <SlidersHorizontal className="size-3.5" />
                Filter
                {secondaryCount ? (
                  <span className="rounded-sm bg-primary/15 px-1 text-[10px] font-medium text-primary">
                    {secondaryCount}
                  </span>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-2 p-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Titel oder Notiz suchen"
                maxLength={100}
                className="h-8 text-xs"
              />
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Kategorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL} className="text-xs">
                    Alle Kategorien
                  </SelectItem>
                  {activeCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL} className="text-xs">
                    Alle Status
                  </SelectItem>
                  {EVENT_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value} className="text-xs">
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center justify-between pt-1">
                <Label htmlFor="show-cancelled" className="text-xs font-normal">
                  Abgesagte anzeigen
                </Label>
                <Switch
                  id="show-cancelled"
                  checked={showCancelled}
                  onCheckedChange={setShowCancelled}
                />
              </div>
              {secondaryCount || showCancelled ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-full text-xs"
                  onClick={() => {
                    setCategoryId(ALL);
                    setStatus(ALL);
                    setSearch("");
                    setShowCancelled(false);
                  }}
                >
                  Zurücksetzen
                </Button>
              ) : null}
            </PopoverContent>
          </Popover>
          )}


          {canEdit ? (
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => openNew()}>
              <Plus className="size-3.5" />
              Eintrag
            </Button>
          ) : null}
        </div>
      </div>

      {events.isPending ? (
        <Skeleton className="h-[70vh] w-full rounded-md" />
      ) : events.isError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-5 py-10 text-center">
          <p className="text-sm font-medium text-destructive">
            Einträge konnten nicht geladen werden.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 h-8 text-xs"
            onClick={() => events.refetch()}
          >
            Erneut versuchen
          </Button>
        </div>
      ) : mode === "jahr" ? (
        <YearOverview
          year={cursor.year}
          events={matrixEvents}
          today={today}
          categoryById={categoryById}
          areaNameById={areaNameById}
          onOpenEvent={openEvent}
          onOpenMonth={(month) => {
            patchSearch({ mode: "kalender", y: cursor.year, m: month });
          }}
        />
      ) : mode === "matrix" ? (
        <MatrixView
          events={matrixEvents}
          areas={matrixAreas}
          year={cursor.year}
          today={today}
          categoryById={categoryById}
          areaNameById={areaNameById}
          jumpMonth={jumpMonth}
          onOpenEvent={openEvent}
          onCreate={openNew}
          onVisibleMonthChange={handleVisibleMonth}

        />
      ) : (
        <MonthCalendar
          year={cursor.year}
          month={cursor.month}
          events={filteredEvents}
          today={today}
          categoryById={categoryById}
          areaNameById={areaNameById}
          availability={
            mode === "verfuegbarkeit" && availabilityStates
              ? { states: availabilityStates, weekdays, onCreateFree: openFreeDate }
              : undefined
          }
          onOpenEvent={openEvent}
          onCreate={(date) => openNew(date)}
        />
      )}

      <EventDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        event={selected}
        {...(prefillDate ? { defaultDate: prefillDate } : {})}
        {...(prefillAreas.length ? { defaultAreaIds: prefillAreas } : {})}
        {...(prefillStatus ? { defaultStatus: prefillStatus } : {})}
      />
    </div>
  );
}
