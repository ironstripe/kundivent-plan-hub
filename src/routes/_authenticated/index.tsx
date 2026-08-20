import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

function FilterPlaceholder({ label }: { label: string }) {
  return (
    <Select disabled>
      <SelectTrigger className="h-8 w-[170px] text-xs">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Alle</SelectItem>
      </SelectContent>
    </Select>
  );
}

function Uebersicht() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight">Eventplanung</h1>
        <span className="text-xs text-muted-foreground">Kundelfingerhof AG</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="size-8" disabled aria-label="Vorjahr">
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-14 text-center text-sm font-medium tabular-nums">2026</span>
          <Button variant="outline" size="icon" className="size-8" disabled aria-label="Folgejahr">
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

        <div className="flex flex-wrap items-center gap-2">
          <FilterPlaceholder label="Planungsbereich" />
          <FilterPlaceholder label="Kategorie" />
          <FilterPlaceholder label="Status" />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div
            className="flex items-center rounded-sm border border-border p-0.5"
            role="group"
            aria-label="Ansicht"
          >
            <span className="rounded-[3px] bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground">
              Timeline
            </span>
            <span className="px-2.5 py-1 text-xs text-muted-foreground">Matrix</span>
          </div>
          <Button size="sm" className="h-8 gap-1.5 text-xs" disabled>
            <Plus className="size-3.5" />
            Eintrag
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-dashed border-border bg-card">
        <div className="min-w-[720px] px-5 py-14 text-center">
          <p className="text-sm font-medium">Timeline und Matrix folgen in Phase 02</p>
          <p className="mx-auto mt-1 max-w-lg text-xs text-muted-foreground">
            In dieser Phase wird nur die Struktur der Planungsansicht angelegt: Jahresnavigation,
            Filter, Ansichtswechsel und die primäre Aktion. Die eigentliche Planung wird im nächsten
            Build umgesetzt.
          </p>
        </div>
      </div>
    </div>
  );
}
