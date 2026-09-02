import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadarMonthView } from "@/components/kundivent/radar-month-view";
import { RadarYearView } from "@/components/kundivent/radar-year-view";
import { RadarDetailDrawer } from "@/components/kundivent/radar-detail-drawer";
import { useEvents } from "@/lib/events";
import {
  filterRadarEvents,
  useRadarEvents,
  useRadarLayers,
  type RadarEvent,
} from "@/lib/radar";
import { RADAR_CITIES, RADAR_TYPE_LABEL, THEME_CATEGORIES } from "@/lib/radar/types";
import { RADAR_DOT_CLASS } from "@/lib/radar/theme";
import { cn } from "@/lib/utils";

type Search = { jahr?: number; monat?: number; ansicht?: "monat" | "jahr" };

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

export const Route = createFileRoute("/_authenticated/radar")({
  head: () => ({
    meta: [
      { title: "Umfeld-Radar – Kundivent" },
      {
        name: "description",
        content:
          "Schulferien, Feiertage, regionale Events und Thementage rund um den Kundelfingerhof auf einen Blick.",
      },
      { property: "og:title", content: "Umfeld-Radar – Kundivent" },
      {
        property: "og:description",
        content: "Planungsumfeld mit Schulferien, Feiertagen, regionalen Events und Thementagen.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): Search => ({
    jahr: search['jahr'] ? Number(search['jahr']) : undefined,
    monat: search['monat'] !== undefined ? Number(search['monat']) : undefined,
    ansicht: search['ansicht'] === "jahr" ? "jahr" : "monat",
  }),
  component: RadarPage,
});

function RadarPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const now = new Date();
  const year = search.jahr ?? now.getFullYear();
  const month = search.monat ?? now.getMonth();
  const view = search.ansicht ?? "monat";

  const { layers, update, toggleIn } = useRadarLayers();

  const from = view === "jahr" ? `${year}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const to =
    view === "jahr"
      ? `${year}-12-31`
      : new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);

  const radar = useRadarEvents(from, to);
  const events = useEvents();

  const visible = useMemo(
    () => filterRadarEvents(radar.data ?? [], layers),
    [radar.data, layers],
  );

  const kundivent = useMemo(
    () =>
      (events.data ?? []).filter((e) => {
        const end = e.end_date ?? e.start_date;
        return e.start_date <= to && end >= from && e.status !== "cancelled";
      }),
    [events.data, from, to],
  );

  const [detail, setDetail] = useState<RadarEvent | null>(null);
  const [createDate, setCreateDate] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const setSearch = (next: Partial<Search>) =>
    navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });

  const shift = (delta: number) => {
    if (view === "jahr") {
      setSearch({ jahr: year + delta });
      return;
    }
    const m = month + delta;
    if (m < 0) setSearch({ jahr: year - 1, monat: 11 });
    else if (m > 11) setSearch({ jahr: year + 1, monat: 0 });
    else setSearch({ monat: m });
  };

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of visible) map.set(e.type, (map.get(e.type) ?? 0) + 1);
    return map;
  }, [visible]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Umfeld-Radar</h1>
          <p className="text-xs text-muted-foreground">
            Schulferien, Feiertage, regionale Events und Thementage – Kontext für die Planung.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs"
            onClick={() => {
              setDetail(null);
              setCreateDate(`${year}-${String(month + 1).padStart(2, "0")}-01`);
              setOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            Umfeld-Ereignis
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" className="size-7" onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-36 text-center text-sm font-medium">
            {view === "jahr" ? year : `${MONTHS[month]} ${year}`}
          </span>
          <Button size="icon" variant="ghost" className="size-7" onClick={() => shift(1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="flex rounded-sm border border-border p-0.5">
          {(["monat", "jahr"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setSearch({ ansicht: v })}
              className={cn(
                "rounded-[3px] px-2.5 py-1 text-xs capitalize transition-colors",
                view === v ? "bg-secondary font-medium" : "text-muted-foreground",
              )}
            >
              {v === "monat" ? "Monat" : "Jahr"}
            </button>
          ))}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {Object.entries(RADAR_TYPE_LABEL).map(([type, label]) => (
            <Badge key={type} variant="outline" className="gap-1.5 text-[11px] font-normal">
              <span className={cn("size-1.5 rounded-full", RADAR_DOT_CLASS[type as keyof typeof RADAR_DOT_CLASS])} />
              {label} {counts.get(type) ?? 0}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-border bg-card px-3 py-2">
        <LayerGroup
          label="Schulferien"
          options={["SH", "TG", "ZH"]}
          selected={layers.schoolCantons}
          onToggle={(v) => toggleIn("schoolCantons", v)}
        />
        <LayerGroup
          label="Feiertage"
          options={["CH", "SH", "TG", "ZH"]}
          selected={layers.holidayCantons}
          onToggle={(v) => toggleIn("holidayCantons", v)}
        />
        <LayerGroup
          label="Orte"
          options={[...RADAR_CITIES]}
          selected={layers.cities}
          onToggle={(v) => toggleIn("cities", v)}
        />
        <LayerGroup
          label="Thementage"
          options={[...THEME_CATEGORIES]}
          selected={layers.themeCategories}
          onToggle={(v) => toggleIn("themeCategories", v)}
        />
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={layers.showKundivent}
            onChange={(e) => update({ showKundivent: e.target.checked })}
          />
          Kundivent-Einträge
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={layers.showLowRelevance}
            onChange={(e) => update({ showLowRelevance: e.target.checked })}
          />
          Geringe Relevanz zeigen
        </label>
      </div>

      {radar.isPending ? (
        <p className="text-xs text-muted-foreground">Radar-Daten werden geladen…</p>
      ) : radar.error ? (
        <p className="text-xs text-destructive">
          {radar.error instanceof Error ? radar.error.message : "Radar konnte nicht geladen werden."}
        </p>
      ) : visible.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-card px-5 py-10 text-center">
          <p className="text-sm font-medium">Keine Umfeld-Daten in diesem Zeitraum</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Passe die Ebenen an oder synchronisiere die Radar-Quellen unter Einstellungen.
          </p>
        </div>
      ) : view === "monat" ? (
        <RadarMonthView
          year={year}
          month={month}
          radarEvents={visible}
          kundiventEvents={kundivent}
          showKundivent={layers.showKundivent}
          onSelect={(event) => {
            setCreateDate(null);
            setDetail(event);
            setOpen(true);
          }}
          onCreate={(date) => {
            setDetail(null);
            setCreateDate(date);
            setOpen(true);
          }}
        />
      ) : (
        <RadarYearView
          year={year}
          radarEvents={visible}
          kundiventEvents={kundivent}
          showKundivent={layers.showKundivent}
          onSelectMonth={(m) => setSearch({ ansicht: "monat", monat: m })}
        />
      )}

      <RadarDetailDrawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setDetail(null);
            setCreateDate(null);
          }
        }}
        event={detail}
        createManual={createDate !== null}
        {...(createDate ? { defaultDate: createDate } : {})}
      />
    </div>
  );
}

function LayerGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onToggle(option)}
          className={cn(
            "rounded-sm border px-1.5 py-0.5 text-[11px] transition-colors",
            selected.includes(option)
              ? "border-primary/40 bg-secondary font-medium"
              : "border-border text-muted-foreground",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
