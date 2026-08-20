import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EventDrawer } from "@/components/kundivent/event-drawer";
import { EventStatusBadge } from "@/components/kundivent/event-status-badge";
import { useCategories, usePlanningAreas } from "@/lib/master-data";
import {
  EVENT_STATUSES,
  formatDateRange,
  formatTimeRange,
  useEvents,
  type EventStatus,
  type EventWithRelations,
} from "@/lib/events";

export const Route = createFileRoute("/_authenticated/eintraege")({
  head: () => ({
    meta: [
      { title: "Einträge – Kundivent" },
      {
        name: "description",
        content: "Listenansicht aller Events, Belegungen und Betriebsferien.",
      },
      { property: "og:title", content: "Einträge – Kundivent" },
      {
        property: "og:description",
        content: "Listenansicht aller Events, Belegungen und Betriebsferien.",
      },
    ],
  }),
  component: Eintraege,
});

const ALL = "all";

function Eintraege() {
  const events = useEvents();
  const areas = usePlanningAreas();
  const categories = useCategories();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<EventWithRelations | null>(null);

  const [year, setYear] = useState<string>(ALL);
  const [areaId, setAreaId] = useState<string>(ALL);
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [search, setSearch] = useState("");

  const areaName = useMemo(() => {
    const map = new Map<string, string>();
    for (const area of areas.data ?? []) map.set(area.id, area.name);
    return map;
  }, [areas.data]);

  const categoryById = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const c of categories.data ?? []) map.set(c.id, { name: c.name, color: c.color });
    return map;
  }, [categories.data]);

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const event of events.data ?? []) {
      set.add(event.start_date.slice(0, 4));
      if (event.end_date) set.add(event.end_date.slice(0, 4));
    }
    return [...set].sort();
  }, [events.data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (events.data ?? []).filter((event) => {
      if (year !== ALL) {
        const from = Number(event.start_date.slice(0, 4));
        const to = Number((event.end_date ?? event.start_date).slice(0, 4));
        if (Number(year) < from || Number(year) > to) return false;
      }
      if (areaId !== ALL && !event.planning_area_ids.includes(areaId)) return false;
      if (categoryId !== ALL && event.category_id !== categoryId) return false;
      if (status !== ALL && event.status !== status) return false;
      if (term) {
        const haystack = `${event.title} ${event.notes ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [events.data, year, areaId, categoryId, status, search]);

  function openNew() {
    setSelected(null);
    setDrawerOpen(true);
  }

  function openEvent(event: EventWithRelations) {
    setSelected(event);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Einträge</h1>
        <span className="text-xs text-muted-foreground">
          {events.data ? `${filtered.length} von ${events.data.length}` : "—"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Titel oder Notiz suchen"
            maxLength={100}
            className="h-8 w-56 pl-7 text-xs"
          />
        </div>

        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue placeholder="Jahr" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="text-xs">
              Alle Jahre
            </SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={y} className="text-xs">
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={areaId} onValueChange={setAreaId}>
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue placeholder="Planungsbereich" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="text-xs">
              Alle Bereiche
            </SelectItem>
            {(areas.data ?? []).map((area) => (
              <SelectItem key={area.id} value={area.id} className="text-xs">
                {area.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue placeholder="Kategorie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="text-xs">
              Alle Kategorien
            </SelectItem>
            {(categories.data ?? []).map((category) => (
              <SelectItem key={category.id} value={category.id} className="text-xs">
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-8 w-[140px] text-xs">
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

        <div className="ml-auto flex items-center gap-2">
          <div
            className="flex items-center rounded-sm border border-border p-0.5"
            role="group"
            aria-label="Ansicht"
          >
            {(
              [
                ["table", "Tabelle"],
                ["timeline", "Timeline"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value)}
                className={cn(
                  "rounded-[3px] px-2.5 py-1 text-xs transition-colors",
                  view === value
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={openNew}>
            <Plus className="size-3.5" />
            Eintrag
          </Button>
        </div>
      </div>

      <section className="overflow-x-auto rounded-md border border-border bg-card">
        {events.isPending ? (
          <p className="px-3 py-10 text-center text-xs text-muted-foreground">Wird geladen…</p>
        ) : events.isError ? (
          <p className="px-3 py-10 text-center text-xs text-destructive">
            Einträge konnten nicht geladen werden.
          </p>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-12 text-center">
            <p className="text-sm font-medium">
              {events.data.length === 0 ? "Noch keine Einträge" : "Keine Treffer"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {events.data.length === 0
                ? "Erstelle den ersten Eintrag für die Eventplanung."
                : "Passe Suche oder Filter an."}
            </p>
            {events.data.length === 0 ? (
              <Button size="sm" className="mt-4 h-8 gap-1.5 text-xs" onClick={openNew}>
                <Plus className="size-3.5" />
                Eintrag
              </Button>
            ) : null}
          </div>
        ) : (
          <Table className="min-w-[900px] text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 w-44 text-xs">Datum</TableHead>
                <TableHead className="h-8 text-xs">Titel</TableHead>
                <TableHead className="h-8 text-xs">Planungsbereiche</TableHead>
                <TableHead className="h-8 w-40 text-xs">Kategorie</TableHead>
                <TableHead className="h-8 w-32 text-xs">Status</TableHead>
                <TableHead className="h-8 w-28 text-xs">Zeit</TableHead>
                <TableHead className="h-8 w-20 text-right text-xs">Personen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((event) => {
                const category = categoryById.get(event.category_id);
                return (
                  <TableRow
                    key={event.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => openEvent(event)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openEvent(event);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <TableCell className="py-1.5 tabular-nums text-xs text-muted-foreground">
                      {formatDateRange(event.start_date, event.end_date)}
                    </TableCell>
                    <TableCell className="py-1.5 font-medium">{event.title}</TableCell>
                    <TableCell className="py-1.5 text-xs text-muted-foreground">
                      {event.planning_area_ids
                        .map((id) => areaName.get(id) ?? "—")
                        .join(", ") || "—"}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-[2px] border border-border"
                          style={{ backgroundColor: category?.color }}
                        />
                        {category?.name ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <EventStatusBadge status={event.status as EventStatus} />
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-muted-foreground tabular-nums">
                      {formatTimeRange(event.all_day, event.start_time, event.end_time)}
                    </TableCell>
                    <TableCell className="py-1.5 text-right text-xs tabular-nums">
                      {event.pax ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <EventDrawer open={drawerOpen} onOpenChange={setDrawerOpen} event={selected} />
    </div>
  );
}
