import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDeleteManualRadarEvent,
  useSaveManualRadarEvent,
  type ManualRadarInput,
  type RadarEvent,
} from "@/lib/radar";
import {
  RADAR_CANTONS,
  RADAR_CITIES,
  RADAR_TYPE_LABEL,
  REGIONAL_CATEGORIES,
  RELEVANCE_LABEL,
  type RadarRelevance,
  type RadarType,
} from "@/lib/radar/types";
import { formatRadarRange } from "@/lib/radar/theme";

const EMPTY: ManualRadarInput = {
  title: "",
  start_date: new Date().toISOString().slice(0, 10),
  end_date: null,
  location_name: null,
  city: null,
  canton: "SH",
  category: "Sonstiges",
  relevance: "medium",
  description: null,
  source_url: null,
};

export function RadarDetailDrawer({
  open,
  onOpenChange,
  event,
  createManual,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: RadarEvent | null;
  createManual: boolean;
  defaultDate?: string;
}) {
  const editable = createManual || Boolean(event?.is_manual);
  const [form, setForm] = useState<ManualRadarInput>(EMPTY);
  const save = useSaveManualRadarEvent();
  const remove = useDeleteManualRadarEvent();

  useEffect(() => {
    if (!open) return;
    if (event?.is_manual) {
      setForm({
        title: event.title,
        start_date: event.start_date,
        end_date: event.end_date,
        location_name: event.location_name,
        city: event.city,
        canton: event.canton,
        category: event.category ?? "Sonstiges",
        relevance: (event.relevance as RadarRelevance) ?? "medium",
        description: event.description,
        source_url: event.source_url,
      });
    } else if (createManual) {
      setForm({ ...EMPTY, start_date: defaultDate ?? EMPTY.start_date });
    }
  }, [open, event, createManual, defaultDate]);

  async function submit() {
    if (!form.title.trim()) {
      toast.error("Bitte einen Titel erfassen.");
      return;
    }
    try {
      await save.mutateAsync({
        ...(event?.id ? { id: event.id } : {}),
        input: { ...form, title: form.title.trim() },
      });
      toast.success(event ? "Umfeld-Ereignis aktualisiert." : "Umfeld-Ereignis erstellt.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    }
  }

  async function del() {
    if (!event) return;
    if (!window.confirm("Dieses manuelle Umfeld-Ereignis löschen?")) return;
    try {
      await remove.mutateAsync(event.id);
      toast.success("Umfeld-Ereignis gelöscht.");
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Löschen fehlgeschlagen.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-3">
          <SheetTitle className="text-base">
            {createManual
              ? "Neues Umfeld-Ereignis"
              : (event?.title ?? "Umfeld-Ereignis")}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {createManual
              ? "Manuell erfasstes regionales Ereignis – nur im Radar sichtbar."
              : event
                ? `${RADAR_TYPE_LABEL[event.type as RadarType] ?? event.type} · ${formatRadarRange(event.start_date, event.end_date)}`
                : ""}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!editable && event ? (
            <ReadOnlyDetails event={event} />
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Titel</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Von</Label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bis (optional)</Label>
                  <Input
                    type="date"
                    value={form.end_date ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, end_date: e.target.value || null }))
                    }
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Ort</Label>
                  <Select
                    value={form.city ?? "none"}
                    onValueChange={(v) => setForm((f) => ({ ...f, city: v === "none" ? null : v }))}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ohne Ort</SelectItem>
                      {RADAR_CITIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Kanton</Label>
                  <Select
                    value={form.canton ?? "SH"}
                    onValueChange={(v) => setForm((f) => ({ ...f, canton: v }))}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RADAR_CANTONS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Veranstaltungsort (frei)</Label>
                <Input
                  value={form.location_name ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, location_name: e.target.value || null }))
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Kategorie</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REGIONAL_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Relevanz</Label>
                  <Select
                    value={form.relevance}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, relevance: v as RadarRelevance }))
                    }
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["high", "medium", "low"] as RadarRelevance[]).map((r) => (
                        <SelectItem key={r} value={r}>
                          {RELEVANCE_LABEL[r]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Beschreibung</Label>
                <Textarea
                  value={form.description ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value || null }))
                  }
                  rows={3}
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Quelle (URL)</Label>
                <Input
                  value={form.source_url ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, source_url: e.target.value || null }))}
                  className="h-8 text-sm"
                  placeholder="https://…"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border px-5 py-3">
          {editable ? (
            <>
              <Button size="sm" className="h-8 text-xs" onClick={submit} disabled={save.isPending}>
                {save.isPending ? "Speichern…" : "Speichern"}
              </Button>
              {event?.is_manual ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1.5 text-xs text-destructive"
                  onClick={del}
                >
                  <Trash2 className="size-3.5" />
                  Löschen
                </Button>
              ) : null}
            </>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className="ml-auto h-8 text-xs"
            onClick={() => onOpenChange(false)}
          >
            Schliessen
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ReadOnlyDetails({ event }: { event: RadarEvent }) {
  const rows: [string, string | null][] = [
    ["Zeitraum", formatRadarRange(event.start_date, event.end_date)],
    ["Ort", event.location_name ?? event.city],
    ["Kanton", event.canton],
    ["Kategorie", event.category],
    ["Relevanz", RELEVANCE_LABEL[(event.relevance as RadarRelevance) ?? "medium"]],
  ];
  return (
    <div className="space-y-4 text-sm">
      {event.description ? (
        <p className="text-sm text-muted-foreground">{event.description}</p>
      ) : null}
      <dl className="grid grid-cols-[7rem_1fr] gap-y-1.5 text-xs">
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      {event.kundivent_idea ? (
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <p className="text-xs font-medium">Idee für Kundivent</p>
          <p className="mt-1 text-xs text-muted-foreground">{event.kundivent_idea}</p>
        </div>
      ) : null}
      {event.source_url ? (
        <a
          href={event.source_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary underline-offset-2 hover:underline"
        >
          <ExternalLink className="size-3.5" />
          Quelle öffnen
        </a>
      ) : null}
      <p className="text-[11px] text-muted-foreground">
        Externe Radar-Daten werden automatisch synchronisiert und sind hier schreibgeschützt.
      </p>
    </div>
  );
}
