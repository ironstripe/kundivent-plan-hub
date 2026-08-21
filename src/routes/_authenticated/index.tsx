import { useMemo, useState } from "react";
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
import { MonthCalendar } from "@/components/kundivent/month-calendar";
import { MatrixView } from "@/components/kundivent/matrix-view";
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

type Mode = "kalender" | "verfuegbarkeit" | "matrix";

const MODES: Mode[] = ["kalender", "verfuegbarkeit", "matrix"];

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
  const events = useEvents();
  const areas = usePlanningAreas();
  const categories = useCategories();

  const today = todayIso();
  const currentYear = Number(today.slice(0, 4));
  const currentMonth = Number(today.slice(5, 7)) - 1;

  const [cursor, setCursor] = useState({ year: currentYear, month: currentMonth });
  const [view, setView] = useState<"month" | "matrix">("month");
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [search, setSearch] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<EventWithRelations | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);
  const [prefillAreas, setPrefillAreas] = useState<string[]>([]);
  const [jumpMonth, setJumpMonth] = useState<{ index: number; nonce: number } | null>(null);

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

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const next = c.month + delta;
      const year = c.year + Math.floor(next / 12);
      const month = ((next % 12) + 12) % 12;
      if (view === "matrix") setJumpMonth({ index: month, nonce: Date.now() });
      return { year, month };
    });
  }

  function goToday() {
    setCursor({ year: currentYear, month: currentMonth });
    if (view === "matrix") setJumpMonth({ index: currentMonth, nonce: Date.now() });
  }

  function switchView(next: "month" | "matrix") {
    setView(next);
    if (next === "matrix") setJumpMonth({ index: cursor.month, nonce: Date.now() });
  }

  function openEvent(event: EventWithRelations) {
    setPrefillDate(null);
    setPrefillAreas([]);
    setSelected(event);
    setDrawerOpen(true);
  }

  function openNew(date?: string, areaId?: string) {
    setPrefillDate(date ?? null);
    setPrefillAreas(areaId ? [areaId] : areaIds.length === 1 ? [areaIds[0]!] : []);
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
            aria-label="Vorheriger Monat"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <h1 className="min-w-[150px] text-center text-sm font-semibold tracking-tight tabular-nums">
            {MONTHS[cursor.month]} {cursor.year}
          </h1>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="Nächster Monat"
            onClick={() => shiftMonth(1)}
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
              ["month", "Monat"],
              ["matrix", "Matrix"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => switchView(value)}
              className={cn(
                "rounded-[3px] px-2.5 py-1 text-xs transition-colors",
                view === value
                  ? "bg-card font-semibold text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>


        <div className="ml-auto flex items-center gap-2">
          <Popover>
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
            </PopoverContent>
          </Popover>


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

          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => openNew()}>
            <Plus className="size-3.5" />
            Eintrag
          </Button>
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
      ) : view === "matrix" ? (
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
        />
      ) : (
        <MonthCalendar
          year={cursor.year}
          month={cursor.month}
          events={filteredEvents}
          today={today}
          categoryById={categoryById}
          areaNameById={areaNameById}
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
      />
    </div>
  );
}
