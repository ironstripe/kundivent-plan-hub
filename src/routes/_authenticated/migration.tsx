import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";
import { EventStatusBadge } from "@/components/kundivent/event-status-badge";
import { useCategories, usePlanningAreas } from "@/lib/master-data";
import { EVENT_STATUSES, formatDateRange, type EventStatus } from "@/lib/events";
import { parseWorkbook, type MigrationRecord, type ParseResult } from "@/lib/migration/parse";
import { useImportMigration, useMigratedRefs } from "@/lib/migration/import";

export const Route = createFileRoute("/_authenticated/migration")({
  head: () => ({
    meta: [
      { title: "Excel-Migration – Kundivent" },
      {
        name: "description",
        content:
          "Migrationswerkzeug: Excel-Eventplanung der Kundelfingerhof AG prüfen und nach Kundivent importieren.",
      },
      { property: "og:title", content: "Excel-Migration – Kundivent" },
      {
        property: "og:description",
        content: "Migrationswerkzeug für die bestehende Excel-Eventplanung.",
      },
    ],
  }),
  component: MigrationPage,
});

type Filter = "all" | "ready" | "review" | "imported";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-r border-border px-3 py-2 last:border-r-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function MigrationPage() {
  const areas = usePlanningAreas();
  const categories = useCategories();
  const migratedRefs = useMigratedRefs();
  const importMutation = useImportMigration();

  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [records, setRecords] = useState<MigrationRecord[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<MigrationRecord | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  const refSet = useMemo(() => new Set(migratedRefs.data ?? []), [migratedRefs.data]);

  const areaIds = useMemo(() => {
    const map = new Map<string, string>();
    for (const area of areas.data ?? []) map.set(area.name, area.id);
    return map;
  }, [areas.data]);

  const categoryIds = useMemo(() => {
    const map = new Map<string, string>();
    for (const category of categories.data ?? []) map.set(category.name, category.id);
    return map;
  }, [categories.data]);

  async function onFile(file: File) {
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseWorkbook(buffer);
      setResult(parsed);
      setRecords(parsed.records);
      setFileName(file.name);
      setLastSummary(null);
      toast.success(
        `${parsed.records.length} Einträge aus ${parsed.sourceCells} Quellzellen aufbereitet`,
      );
    } catch (error) {
      toast.error("Datei konnte nicht gelesen werden", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  const filtered = useMemo(() => {
    return records.filter((record) => {
      const imported = refSet.has(record.ref);
      if (filter === "imported") return imported;
      if (filter === "ready") return !imported && !record.reviewRequired;
      if (filter === "review") return !imported && record.reviewRequired;
      return true;
    });
  }, [records, filter, refSet]);

  const readyRecords = records.filter(
    (record) => !record.reviewRequired && !refSet.has(record.ref),
  );

  function applyEdit(updated: MigrationRecord) {
    setRecords((prev) => prev.map((r) => (r.ref === updated.ref ? updated : r)));
    setEditing(null);
  }

  async function runImport() {
    if (!readyRecords.length) {
      toast.info("Keine importbereiten Einträge");
      return;
    }
    const outcome = await importMutation.mutateAsync({
      records: readyRecords,
      areaIds,
      categoryIds,
      existingRefs: new Set(refSet),
    });
    setLastSummary(
      [
        `Importiert: ${outcome.imported}`,
        `Bereits vorhanden (übersprungen): ${outcome.duplicates}`,
        `Fehlgeschlagen: ${outcome.failed.length}`,
        ...outcome.failed.map((f) => `• ${f.ref}: ${f.message}`),
      ].join("\n"),
    );
    if (outcome.failed.length) toast.error(`${outcome.failed.length} Einträge fehlgeschlagen`);
    else toast.success(`${outcome.imported} Einträge importiert`);
  }

  const consolidated = records.filter((r) => r.consolidatedDays).length;
  const multiArea = records.filter((r) => r.mergedAreas).length;
  const paxCount = records.filter((r) => r.pax != null).length;
  const reviewCount = records.filter((r) => r.reviewRequired).length;
  const importedCount = records.filter((r) => refSet.has(r.ref)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Excel-Migration</h1>
          <p className="text-xs text-muted-foreground">
            Migrationswerkzeug – nicht Teil der operativen Navigation.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">{fileName || "Keine Datei geladen"}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
            e.target.value = "";
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-3.5" />
          Excel-Datei wählen
        </Button>
        <span className="text-xs text-muted-foreground">
          Blätter 2026 / 2027 / 2028 werden gelesen, Wochenend-Übersicht nur zur Validierung.
        </span>
        <Button
          size="sm"
          className="ml-auto h-8 text-xs"
          disabled={!readyRecords.length || importMutation.isPending}
          onClick={() => void runImport()}
        >
          {importMutation.isPending
            ? "Import läuft…"
            : `${readyRecords.length} Einträge importieren`}
        </Button>
      </div>

      {result ? (
        <>
          <div className="grid grid-cols-2 rounded-md border border-border bg-card sm:grid-cols-4 lg:grid-cols-8">
            <Stat label="Quellzellen" value={result.sourceCells} />
            <Stat label="Vorgeschlagene Events" value={records.length} />
            <Stat label="Bereits importiert" value={importedCount} />
            <Stat label="Mehrtägig konsolidiert" value={consolidated} />
            <Stat label="Mehrbereichs-Events" value={multiArea} />
            <Stat label="Pax erkannt" value={paxCount} />
            <Stat label="Prüfung nötig" value={reviewCount} />
            <Stat label="Übersprungen" value={result.skipped.length} />
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-card px-2 py-1.5">
            {(
              [
                ["all", `Alle (${records.length})`],
                ["ready", `Importbereit (${readyRecords.length})`],
                ["review", `Prüfung nötig (${reviewCount})`],
                ["imported", `Importiert (${importedCount})`],
              ] as [Filter, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={cn(
                  "rounded-sm px-2.5 py-1 text-xs transition-colors hover:bg-accent",
                  filter === value
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <section className="overflow-x-auto rounded-md border border-border bg-card">
            <Table className="min-w-[1000px] text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 w-40 text-xs">Datum</TableHead>
                  <TableHead className="h-8 text-xs">Titel</TableHead>
                  <TableHead className="h-8 w-40 text-xs">Excel-Spalte</TableHead>
                  <TableHead className="h-8 w-48 text-xs">Planungsbereich(e)</TableHead>
                  <TableHead className="h-8 w-40 text-xs">Kategorie</TableHead>
                  <TableHead className="h-8 w-28 text-xs">Status</TableHead>
                  <TableHead className="h-8 w-16 text-right text-xs">Pax</TableHead>
                  <TableHead className="h-8 w-44 text-xs">Prüfung</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((record) => {
                  const imported = refSet.has(record.ref);
                  return (
                    <TableRow
                      key={record.ref}
                      className="cursor-pointer"
                      onClick={() => setEditing(record)}
                    >
                      <TableCell className="py-1.5 text-xs tabular-nums text-muted-foreground">
                        {formatDateRange(record.startDate, record.endDate)}
                      </TableCell>
                      <TableCell className="py-1.5 font-medium">{record.title}</TableCell>
                      <TableCell className="py-1.5 text-xs text-muted-foreground">
                        {record.sheet} · {record.sourceColumns.join(", ")}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs">
                        {record.areaNames.join(", ") || (
                          <span className="text-destructive">nicht zugewiesen</span>
                        )}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs">{record.categoryName}</TableCell>
                      <TableCell className="py-1.5">
                        <EventStatusBadge status={record.status} />
                      </TableCell>
                      <TableCell className="py-1.5 text-right text-xs tabular-nums">
                        {record.pax ?? "—"}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs">
                        {imported ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <CheckCircle2 className="size-3" aria-hidden />
                            Importiert
                          </span>
                        ) : record.reviewRequired ? (
                          <span
                            className="inline-flex items-start gap-1 text-warning-foreground"
                            title={record.reviewReasons.join(" · ")}
                          >
                            <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                            <span className="line-clamp-2">{record.reviewReasons[0]}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">bereit</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {filtered.length === 0 ? (
              <p className="px-3 py-10 text-center text-xs text-muted-foreground">
                Keine Einträge in dieser Auswahl.
              </p>
            ) : null}
          </section>

          {lastSummary ? (
            <section className="rounded-md border border-border bg-card p-3">
              <h2 className="text-xs font-semibold">Import-Ergebnis</h2>
              <pre className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                {lastSummary}
              </pre>
            </section>
          ) : null}

          <section className="rounded-md border border-border bg-card p-3">
            <h2 className="text-xs font-semibold">
              Übersprungene Quellzellen ({result.skipped.length})
            </h2>
            {result.skipped.length ? (
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {result.skipped.map((cell, index) => (
                  <li key={`${cell.sheet}-${cell.row}-${cell.column}-${index}`}>
                    {cell.sheet} Zeile {cell.row} · {cell.column} · «{cell.text}» — {cell.reason}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Keine Quellzelle verworfen.</p>
            )}
          </section>

          <section className="rounded-md border border-border bg-card p-3">
            <h2 className="text-xs font-semibold">
              Abgleich Wochenend-Übersicht ({result.weekendChecked} geprüfte Tage,{" "}
              {result.weekendMismatches.length} Abweichungen)
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Referenzprüfung ohne Import: Frei/Belegt aus dem Excel-Blatt gegen die migrierten
              Restaurant- und Bankett-Einträge. Die Verfügbarkeitslogik selbst folgt in Build 06.
            </p>
            {result.weekendMismatches.length ? (
              <ul className="mt-2 max-h-52 space-y-0.5 overflow-y-auto text-xs text-muted-foreground">
                {result.weekendMismatches.map((mismatch) => (
                  <li key={`${mismatch.date}-${mismatch.weekday}`}>
                    {formatDateRange(mismatch.date, null)} ({mismatch.weekday}): Excel{" "}
                    {mismatch.sheetStatus} · migriert {mismatch.derivedStatus}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        </>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-card px-5 py-14 text-center">
          <p className="text-sm font-medium">Keine Migrationsdaten geladen</p>
          <p className="mx-auto mt-1 max-w-lg text-xs text-muted-foreground">
            Wähle die bestehende Excel-Eventplanung aus. Die Daten werden lokal aufbereitet und erst
            nach Prüfung in die Datenbank geschrieben.
          </p>
        </div>
      )}

      <RecordDialog
        record={editing}
        onClose={() => setEditing(null)}
        onSave={applyEdit}
        areaNames={(areas.data ?? []).filter((a) => a.active).map((a) => a.name)}
        categoryNames={(categories.data ?? []).filter((c) => c.active).map((c) => c.name)}
      />
    </div>
  );
}

function RecordDialog({
  record,
  onClose,
  onSave,
  areaNames,
  categoryNames,
}: {
  record: MigrationRecord | null;
  onClose: () => void;
  onSave: (record: MigrationRecord) => void;
  areaNames: string[];
  categoryNames: string[];
}) {
  const [draft, setDraft] = useState<MigrationRecord | null>(null);
  const current = draft && record && draft.ref === record.ref ? draft : record;

  if (!record || !current) {
    return (
      <Dialog open={false} onOpenChange={onClose}>
        <DialogContent />
      </Dialog>
    );
  }

  function update(patch: Partial<MigrationRecord>) {
    setDraft({ ...current!, ...patch });
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? undefined : (setDraft(null), onClose()))}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">Migrationseintrag prüfen</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="rounded-sm border border-border bg-muted/40 px-2 py-1.5 text-[11px] text-muted-foreground">
            Quelle: {current.sheet} · Zeile(n) {current.rows.join(", ")} ·{" "}
            {current.sourceColumns.join(", ")} · Originaltext: «{current.originalText}»
          </p>

          {current.reviewReasons.length ? (
            <ul className="space-y-0.5 text-[11px] text-warning-foreground">
              {current.reviewReasons.map((reason) => (
                <li key={reason}>• {reason}</li>
              ))}
            </ul>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs">Titel</Label>
            <Input
              value={current.title}
              onChange={(e) => update({ title: e.target.value })}
              className="h-8 text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Planungsbereiche</Label>
            <div className="grid grid-cols-2 gap-1 rounded-md border border-border p-1.5">
              {areaNames.map((name) => (
                <label key={name} className="flex items-center gap-2 px-1 py-0.5 text-xs">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-[var(--primary)]"
                    checked={current.areaNames.includes(name)}
                    onChange={() =>
                      update({
                        areaNames: current.areaNames.includes(name)
                          ? current.areaNames.filter((a) => a !== name)
                          : [...current.areaNames, name],
                      })
                    }
                  />
                  {name}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Kategorie</Label>
              <Select
                value={current.categoryName}
                onValueChange={(value) => update({ categoryName: value })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryNames.map((name) => (
                    <SelectItem key={name} value={name} className="text-xs">
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select
                value={current.status}
                onValueChange={(value) => update({ status: value as EventStatus })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value} className="text-xs">
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Start</Label>
              <Input
                type="date"
                value={current.startDate}
                onChange={(e) => update({ startDate: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Ende</Label>
              <Input
                type="date"
                value={current.endDate ?? ""}
                onChange={(e) => update({ endDate: e.target.value || null })}
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Pax</Label>
              <Input
                type="number"
                min={1}
                value={current.pax ?? ""}
                onChange={(e) =>
                  update({ pax: e.target.value ? Number(e.target.value) : null })
                }
                className="h-8 text-xs"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setDraft(null);
              onClose();
            }}
          >
            Abbrechen
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={!current.title.trim() || current.areaNames.length === 0}
            onClick={() => {
              setDraft(null);
              onSave({ ...current, reviewRequired: false });
            }}
          >
            Als geprüft markieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
