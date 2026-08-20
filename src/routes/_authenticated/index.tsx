import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft, ChevronRight, Plus, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { TimelineEventRow } from "@/components/kundivent/timeline-event-row";
import { useCategories, usePlanningAreas } from "@/lib/master-data";
import { publicHolidays } from "@/lib/holidays";
import { EVENT_STATUSES, useEvents, type EventWithRelations } from "@/lib/events";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Eventplanung – Kundivent" },
      {
        name: "description",
        content:
          "Jahresübersicht der Events, Belegungen und Betriebsferien der Kundelfingerhof AG.",
      },
      { property: "og:title", content: "Eventplanung – Kundivent" },
      {
        property: "og:description",
        content:
          "Jahresübersicht der Events, Belegungen und Betriebsferien der Kundelfingerhof AG.",
      },
    ],
  }),
  component: Uebersicht,
});

const ALL = "all";
const YEAR_STORAGE_KEY = "kundivent.timeline.year";

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

  const [year, setYear] = useState(currentYear);
  const [view, setView] = useState<"timeline" | "matrix">("timeline");
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<EventWithRelations | null>(null);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);
  const [prefillAreas, setPrefillAreas] = useState<string[]>([]);
  const [jumpMonth, setJumpMonth] = useState<{ index: number; nonce: number } | null>(null);

  const monthRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const stored = Number(window.localStorage.getItem(YEAR_STORAGE_KEY));
    if (stored >= 1970 && stored <= 3000) setYear(stored);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(YEAR_STORAGE_KEY, String(year));
  }, [year]);

  const activeAreas = useMemo(
    () => (areas.data ?? []).filter((a) => a.active),
    [areas.data],
  );
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

  const monthGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const groups: EventWithRelations[][] = Array.from({ length: 12 }, () => []);
    for (const event of events.data ?? []) {
      const start = event.start_date;
      const end = event.end_date ?? event.start_date;
      if (Number(end.slice(0, 4)) < year || Number(start.slice(0, 4)) > year) continue;
      if (areaIds.length && !event.planning_area_ids.some((id) => areaIds.includes(id))) continue;
      if (categoryId !== ALL && event.category_id !== categoryId) continue;
      if (status !== ALL && event.status !== status) continue;
      if (term && !`${event.title} ${event.notes ?? ""}`.toLowerCase().includes(term)) continue;
      const monthIndex =
        Number(start.slice(0, 4)) < year ? 0 : Number(start.slice(5, 7)) - 1;
      groups[monthIndex]?.push(event);
    }
    for (const group of groups) {
      group.sort(
        (a, b) =>
          a.start_date.localeCompare(b.start_date) ||
          (a.start_time ?? "99").localeCompare(b.start_time ?? "99") ||
          a.title.localeCompare(b.title),
      );
    }
    return groups;
  }, [events.data, year, areaIds, categoryId, status, search]);

  const totalCount = monthGroups.reduce((sum, g) => sum + g.length, 0);

  const holidaysByMonth = useMemo(() => {
    const groups: { date: string; name: string }[][] = Array.from({ length: 12 }, () => []);
    for (const h of publicHolidays(year)) groups[Number(h.date.slice(5, 7)) - 1]?.push(h);
    return groups;
  }, [year]);

  const availableYears = useMemo(() => {
    const set = new Set<number>([currentYear, year]);
    for (const e of events.data ?? []) {
      set.add(Number(e.start_date.slice(0, 4)));
      if (e.end_date) set.add(Number(e.end_date.slice(0, 4)));
    }
    return [...set].sort((a, b) => a - b);
  }, [events.data, currentYear, year]);

  const filtersActive =
    areaIds.length > 0 || categoryId !== ALL || status !== ALL || search.trim() !== "";

  function resetFilters() {
    setAreaIds([]);
    setCategoryId(ALL);
    setStatus(ALL);
    setSearch("");
  }

  function openEvent(event: EventWithRelations) {
    setPrefillDate(null);
    setSelected(event);
    setDrawerOpen(true);
  }

  function openNew(date?: string) {
    setPrefillDate(date ?? null);
    setSelected(null);
    setDrawerOpen(true);
  }

  function jumpToMonth(index: number) {
    monthRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function goToday() {
    setYear(currentYear);
    window.setTimeout(() => jumpToMonth(new Date().getMonth()), 80);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Eventplanung</h1>
        <span className="text-xs text-muted-foreground">
          Kundelfingerhof AG · {totalCount} {totalCount === 1 ? "Eintrag" : "Einträge"} {year}
        </span>
      </div>

      <div className="sticky top-0 z-20 -mx-1 space-y-2 rounded-md border border-border bg-card/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Vorjahr"
              onClick={() => setYear((y) => y - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
              <SelectTrigger className="h-8 w-[92px] text-sm font-medium tabular-nums">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map((y) => (
                  <SelectItem key={y} value={String(y)} className="text-xs tabular-nums">
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Folgejahr"
              onClick={() => setYear((y) => y + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={goToday}
              disabled={view !== "timeline"}
            >
              Heute
            </Button>
          </div>

          <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen"
              maxLength={100}
              className="h-8 w-40 pl-7 text-xs"
            />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                {areaIds.length ? `Bereiche (${areaIds.length})` : "Planungsbereich"}
                <ChevronDown className="size-3.5 opacity-60" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-60 p-2">
              <div className="space-y-1">
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
                      {area.name}
                    </label>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>

          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
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
            <SelectTrigger className="h-8 w-[130px] text-xs">
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

          {filtersActive ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs"
              onClick={resetFilters}
            >
              <RotateCcw className="size-3.5" />
              Zurücksetzen
            </Button>
          ) : null}

          <div className="ml-auto flex items-center gap-2">
            <div
              className="flex items-center rounded-sm border border-border p-0.5"
              role="group"
              aria-label="Ansicht"
            >
              {(["timeline", "matrix"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded-[3px] px-2.5 py-1 text-xs capitalize transition-colors",
                    view === v
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v === "timeline" ? "Timeline" : "Matrix"}
                </button>
              ))}
            </div>
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => openNew()}>
              <Plus className="size-3.5" />
              Eintrag
            </Button>
          </div>
        </div>

        {view === "timeline" ? (
          <div className="flex flex-wrap items-center gap-0.5 border-t border-border pt-2">
            {MONTHS_SHORT.map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => jumpToMonth(i)}
                className={cn(
                  "rounded-sm px-1.5 py-0.5 text-[11px] transition-colors hover:bg-accent",
                  monthGroups[i]?.length
                    ? "font-medium text-foreground"
                    : "text-muted-foreground/60",
                  year === currentYear && i === new Date().getMonth()
                    ? "text-primary underline underline-offset-4"
                    : null,
                )}
              >
                {m}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {view === "matrix" ? (
        events.isPending ? (
          <Skeleton className="h-[60vh] w-full rounded-md" />
        ) : events.isError ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-5 py-10 text-center">
            <p className="text-sm font-medium text-destructive">
              Einträge konnten nicht geladen werden.
            </p>
          </div>
        ) : (
          <MatrixView
            events={filteredEvents}
            areas={matrixAreas}
            year={year}
            today={today}
            categoryById={categoryById}
            areaNameById={areaNameById}
            jumpMonth={jumpMonth}
            onOpenEvent={openEvent}
            onCreate={openNew}
          />
        )
      ) : events.isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full rounded-sm" />
          ))}
        </div>
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
      ) : totalCount === 0 ? (
        <div className="rounded-md border border-border bg-card px-5 py-12 text-center">
          <p className="text-sm font-medium">
            {filtersActive ? "Keine Treffer" : `Keine Einträge für ${year}`}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {filtersActive
              ? "Passe Suche oder Filter an."
              : "Für dieses Jahr sind noch keine Einträge vorhanden."}
          </p>
          {filtersActive ? (
            <Button variant="outline" size="sm" className="mt-4 h-8 text-xs" onClick={resetFilters}>
              Filter zurücksetzen
            </Button>
          ) : (
            <Button size="sm" className="mt-4 h-8 gap-1.5 text-xs" onClick={() => openNew()}>
              <Plus className="size-3.5" />
              Eintrag
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {MONTHS.map((month, index) => {
            const group = monthGroups[index] ?? [];
            const holidays = holidaysByMonth[index] ?? [];
            const isCurrentMonth = year === currentYear && index === new Date().getMonth();
            const monthDate = `${year}-${String(index + 1).padStart(2, "0")}-01`;
            return (
              <section
                key={month}
                ref={(el) => {
                  monthRefs.current[index] = el;
                }}
                className="scroll-mt-32"
              >
                <div className="mb-1.5 flex items-center gap-2">
                  <h2
                    className={cn(
                      "text-xs font-semibold uppercase tracking-wider",
                      group.length ? "text-foreground" : "text-muted-foreground/70",
                      isCurrentMonth && "text-primary",
                    )}
                  >
                    {month} {year}
                  </h2>
                  <span className="h-px flex-1 bg-border" />
                  {group.length ? (
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {group.length}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openNew(monthDate)}
                    aria-label={`Eintrag in ${month} erstellen`}
                    className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>

                {group.length ? (
                  <div className="space-y-1">
                    {group.map((event) => (
                      <TimelineEventRow
                        key={event.id}
                        event={event}
                        areaNames={event.planning_area_ids
                          .map((id) => areaNameById.get(id) ?? "")
                          .filter(Boolean)}
                        category={categoryById.get(event.category_id)}
                        today={today}
                        onOpen={openEvent}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="px-0.5 text-[11px] text-muted-foreground/70">Keine Einträge</p>
                )}

                {holidays.length ? (
                  <p className="mt-1 px-0.5 text-[11px] text-muted-foreground/60">
                    Feiertage:{" "}
                    {holidays
                      .map((h) => `${h.date.slice(8, 10)}. ${MONTHS_SHORT[index]} ${h.name}`)
                      .join(" · ")}
                  </p>
                ) : null}
              </section>
            );
          })}
        </div>
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
