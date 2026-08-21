import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { displayAreaKeyFromNames } from "@/lib/area-theme";

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
import { TimelineEventRow } from "@/components/kundivent/timeline-event-row";
import { useCategories, usePlanningAreas } from "@/lib/master-data";
import { profileLabel, useProfiles, type Profile } from "@/lib/users";
import { cn } from "@/lib/utils";
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
const UNASSIGNED = "unassigned";

function Eintraege() {
  const events = useEvents();
  const areas = usePlanningAreas();
  const categories = useCategories();
  const profiles = useProfiles();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<EventWithRelations | null>(null);
  const [view, setView] = useState<"table" | "timeline">("table");

  const [year, setYear] = useState<string>(ALL);
  const [areaId, setAreaId] = useState<string>(ALL);
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [responsible, setResponsible] = useState<string>(ALL);
  const [creator, setCreator] = useState<string>(ALL);
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

  const profileById = useMemo(() => {
    const map = new Map<string, Profile>();
    for (const p of profiles.data ?? []) map.set(p.id, p);
    return map;
  }, [profiles.data]);

  const responsibleOptions = useMemo(() => {
    const assigned = new Set(
      (events.data ?? []).map((e) => e.responsible_user_id).filter(Boolean) as string[],
    );
    return (profiles.data ?? []).filter((p) => p.active || assigned.has(p.id));
  }, [profiles.data, events.data]);

  const creatorOptions = useMemo(() => {
    const assigned = new Set(
      (events.data ?? []).map((e) => e.created_by).filter(Boolean) as string[],
    );
    return (profiles.data ?? []).filter((p) => p.active || assigned.has(p.id));
  }, [profiles.data, events.data]);

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
      if (responsible === UNASSIGNED && event.responsible_user_id) return false;
      if (responsible !== ALL && responsible !== UNASSIGNED && event.responsible_user_id !== responsible)
        return false;
      if (creator === UNASSIGNED && event.created_by) return false;
      if (creator !== ALL && creator !== UNASSIGNED && event.created_by !== creator) return false;
      if (term) {
        const haystack = `${event.title} ${event.notes ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [events.data, year, areaId, categoryId, status, responsible, creator, search]);

  function openNew() {
    setSelected(null);
    setDrawerOpen(true);
  }

  function openEvent(event: EventWithRelations) {
    setSelected(event);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-base font-semibold tracking-tight">Einträge</h1>

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

        <Select value={responsible} onValueChange={setResponsible}>
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue placeholder="Verantwortlich" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="text-xs">
              Alle Verantwortlichen
            </SelectItem>
            <SelectItem value={UNASSIGNED} className="text-xs">
              Nicht zugewiesen
            </SelectItem>
            {responsibleOptions.map((profile) => (
              <SelectItem key={profile.id} value={profile.id} className="text-xs">
                {profileLabel(profile)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={creator} onValueChange={setCreator}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue placeholder="Erstellt von" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="text-xs">
              Alle Ersteller
            </SelectItem>
            <SelectItem value={UNASSIGNED} className="text-xs">
              Ohne Angabe
            </SelectItem>
            {creatorOptions.map((profile) => (
              <SelectItem key={profile.id} value={profile.id} className="text-xs">
                {profileLabel(profile)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>


        <div className="ml-auto flex items-center gap-2">
          <div
            className="inline-flex items-center rounded-sm bg-muted p-0.5"
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
                aria-pressed={view === value}
                onClick={() => setView(value)}
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
        ) : view === "timeline" ? (
          <div className="space-y-4 p-3">
            {groupByMonth(filtered).map(([label, group]) => (
              <div key={label}>
                <div className="mb-1.5 flex items-center gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                    {label}
                  </h2>
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {group.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {group.map((event) => (
                    <TimelineEventRow
                      key={event.id}
                      event={event}
                      areaNames={event.planning_area_ids
                        .map((id) => areaName.get(id) ?? "")
                        .filter(Boolean)}
                      category={categoryById.get(event.category_id)}
                      today={todayIso()}
                      onOpen={openEvent}
                    />
                  ))}
                </div>
              </div>
            ))}
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
                <TableHead className="h-8 w-40 text-xs">Verantwortlich</TableHead>
                <TableHead className="h-8 w-28 text-xs">Zeit</TableHead>
                <TableHead className="h-8 w-20 text-right text-xs">Personen</TableHead>
                <TableHead className="h-8 w-32 text-xs">Erstellt</TableHead>
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
                    <TableCell className="py-1.5 font-medium">
                      <span className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="h-3.5 w-[3px] shrink-0 rounded-full"
                          style={{
                            backgroundColor: `var(--area-${displayAreaKeyFromNames(
                              event.planning_area_ids.map((id) => areaName.get(id) ?? ""),
                            )})`,
                          }}
                        />
                        <span className={cn(event.status === "cancelled" && "line-through")}>
                          {event.title}
                        </span>
                      </span>
                    </TableCell>
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
                    <TableCell className="py-1.5 text-xs text-muted-foreground">
                      {(event.responsible_user_id
                        ? profileLabel(profileById.get(event.responsible_user_id))
                        : null) ?? "–"}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-muted-foreground tabular-nums">
                      {formatTimeRange(event.all_day, event.start_time, event.end_time)}
                    </TableCell>
                    <TableCell className="py-1.5 text-right text-xs tabular-nums">
                      {event.pax ?? "—"}
                      {event.deposit_received ? (
                        <span className="ml-1 block text-[10px] text-muted-foreground">
                          Anzahlung
                          {event.deposit_amount != null
                            ? ` CHF ${Number(event.deposit_amount).toFixed(2)}`
                            : ""}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-muted-foreground tabular-nums">
                      {formatCreatedAt(event.created_at, false)}
                      <span className="block text-[10px] tabular-nums-none">
                        {event.created_by
                          ? profileLabel(profileById.get(event.created_by)) || "Unbekannt"
                          : "Import"}
                      </span>
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

const MONTH_NAMES = [
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

function groupByMonth(events: EventWithRelations[]): [string, EventWithRelations[]][] {
  const map = new Map<string, EventWithRelations[]>();
  for (const event of [...events].sort(
    (a, b) =>
      a.start_date.localeCompare(b.start_date) ||
      (a.start_time ?? "99").localeCompare(b.start_time ?? "99") ||
      a.title.localeCompare(b.title),
  )) {
    const key = event.start_date.slice(0, 7);
    const list = map.get(key);
    if (list) list.push(event);
    else map.set(key, [event]);
  }
  return [...map.entries()].map(([key, group]) => [
    `${MONTH_NAMES[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`,
    group,
  ]);
}
