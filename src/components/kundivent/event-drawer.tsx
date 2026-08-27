import { useEffect, useMemo, useRef, useState } from "react";
import { setFormDirty, useIsOnline } from "@/lib/connection";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useCategories, usePlanningAreas } from "@/lib/master-data";
import {
  EVENT_STATUSES,
  formatCreatedAt,
  HOLIDAY_ALLOWED_AREAS,
  HOLIDAY_CATEGORY,
  useDeleteEvent,
  useSaveEvent,
  type EventInput,
  type EventStatus,
  type EventWithRelations,
} from "@/lib/events";
import { profileLabel, useProfiles } from "@/lib/users";
import { addPending, removePending } from "@/lib/offline-queue";
import { useCurrentUserId } from "@/lib/offline-sync";
import { CommunicationSection } from "@/components/kundivent/communication-section";
import { generateInboundToken } from "@/lib/event-email";
import { uploadAttachment } from "@/lib/attachments";

type FormState = {
  title: string;
  status: EventStatus;
  category_id: string;
  planning_area_ids: string[];
  start_date: string;
  end_date: string;
  all_day: boolean;
  start_time: string;
  end_time: string;
  pax: string;
  notes: string;
  deposit_received: boolean;
  deposit_amount: string;
  deposit_received_at: string;
  responsible_user_id: string;
};

const EMPTY: FormState = {
  title: "",
  status: "idea",
  category_id: "",
  planning_area_ids: [],
  start_date: "",
  end_date: "",
  all_day: true,
  start_time: "",
  end_time: "",
  pax: "",
  notes: "",
  deposit_received: false,
  deposit_amount: "",
  deposit_received_at: "",
  responsible_user_id: "",
};

function fromEvent(event: EventWithRelations): FormState {
  return {
    title: event.title,
    status: event.status,
    category_id: event.category_id,
    planning_area_ids: [...event.planning_area_ids],
    start_date: event.start_date,
    end_date: event.end_date ?? "",
    all_day: event.all_day,
    start_time: event.start_time?.slice(0, 5) ?? "",
    end_time: event.end_time?.slice(0, 5) ?? "",
    pax: event.pax != null ? String(event.pax) : "",
    notes: event.notes ?? "",
    deposit_received: event.deposit_received ?? false,
    deposit_amount: event.deposit_amount != null ? String(event.deposit_amount) : "",
    deposit_received_at: event.deposit_received_at ?? "",
    responsible_user_id: event.responsible_user_id ?? "",
  };
}

const NONE = "__none__";

function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return <p className="text-[11px] text-destructive">{message}</p>;
}

export function EventDrawer({
  open,
  onOpenChange,
  event,
  defaultDate,
  defaultAreaIds,
  defaultStatus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: EventWithRelations | null;
  defaultDate?: string;
  defaultAreaIds?: string[];
  defaultStatus?: EventStatus;
}) {
  const areas = usePlanningAreas();
  const categories = useCategories();
  const profiles = useProfiles();
  const save = useSaveEvent();
  const remove = useDeleteEvent();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** Files chosen before a new event exists — uploaded right after saving. */
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  /** Inbound e-mail token for a NEW entry — generated as soon as the drawer opens. */
  const [newToken, setNewToken] = useState<string | null>(null);
  const online = useIsOnline();
  const userId = useCurrentUserId();
  const baselineRef = useRef<string>("");
  const dirtyRef = useRef(false);

  /** Entries that only exist in the local queue. */
  const isLocal = event?.is_pending === true;
  /** Server entries can only be viewed while offline. */
  const readOnly = !online && !!event;


  const activeAreas = useMemo(() => (areas.data ?? []).filter((a) => a.active), [areas.data]);
  const activeCategories = useMemo(
    () => (categories.data ?? []).filter((c) => c.active),
    [categories.data],
  );

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setPendingFiles([]);
    setNewToken(event ? null : generateInboundToken());
    const initial: FormState = event
      ? fromEvent(event)
      : {
          ...EMPTY,
          ...(defaultDate ? { start_date: defaultDate } : {}),
          ...(defaultAreaIds?.length ? { planning_area_ids: [...defaultAreaIds] } : {}),
          ...(defaultStatus ? { status: defaultStatus } : {}),
        };
    baselineRef.current = JSON.stringify(initial);
    setForm(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event, defaultDate, defaultAreaIds?.join(","), defaultStatus]);


  // Keeps the PWA update prompt from discarding in-progress edits.
  useEffect(() => {
    const dirty = open && JSON.stringify(form) !== baselineRef.current;
    if (dirty === dirtyRef.current) return;
    dirtyRef.current = dirty;
    setFormDirty(dirty);
  }, [open, form]);

  useEffect(
    () => () => {
      if (dirtyRef.current) {
        dirtyRef.current = false;
        setFormDirty(false);
      }
    },
    [],
  );

  const responsibleOptions = useMemo(() => {
    const all = profiles.data ?? [];
    // Active users are selectable; an inactive user stays listed while still assigned.
    return all.filter((p) => p.active || p.id === form.responsible_user_id);
  }, [profiles.data, form.responsible_user_id]);

  const selectedCategory = activeCategories.find((c) => c.id === form.category_id);
  const isHoliday = selectedCategory?.name === HOLIDAY_CATEGORY;

  function update(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function onCategoryChange(categoryId: string) {
    const category = activeCategories.find((c) => c.id === categoryId);
    if (category?.name === HOLIDAY_CATEGORY) {
      update({
        category_id: categoryId,
        all_day: true,
        status: "confirmed",
        planning_area_ids: form.planning_area_ids.filter((id) =>
          HOLIDAY_ALLOWED_AREAS.includes(activeAreas.find((a) => a.id === id)?.name ?? ""),
        ),
      });
      return;
    }
    update({ category_id: categoryId });
  }

  function toggleArea(id: string) {
    update({
      planning_area_ids: form.planning_area_ids.includes(id)
        ? form.planning_area_ids.filter((a) => a !== id)
        : [...form.planning_area_ids, id],
    });
  }

  function validate(): EventInput | null {
    const next: Record<string, string> = {};
    if (!form.title.trim()) next['title'] = "Titel ist erforderlich.";
    if (!form.category_id) next['category_id'] = "Kategorie ist erforderlich.";
    if (form.planning_area_ids.length === 0)
      next['planning_area_ids'] = "Mindestens ein Planungsbereich ist erforderlich.";
    if (!form.start_date) next['start_date'] = "Startdatum ist erforderlich.";
    if (form.end_date && form.start_date && form.end_date < form.start_date)
      next['end_date'] = "Enddatum darf nicht vor dem Startdatum liegen.";

    if (isHoliday) {
      const invalid = form.planning_area_ids
        .map((id) => activeAreas.find((a) => a.id === id)?.name ?? "")
        .filter((name) => !HOLIDAY_ALLOWED_AREAS.includes(name));
      if (invalid.length)
        next['planning_area_ids'] =
          `Betriebsferien sind nur für ${HOLIDAY_ALLOWED_AREAS.join(", ")} möglich. Nicht erlaubt: ${invalid.join(", ")}.`;
    }

    let pax: number | null = null;
    if (form.pax.trim()) {
      const parsed = Number(form.pax);
      if (!Number.isInteger(parsed) || parsed <= 0)
        next['pax'] = "Personen muss eine positive ganze Zahl sein.";
      else pax = parsed;
    }

    let depositAmount: number | null = null;
    if (form.deposit_received && form.deposit_amount.trim()) {
      const parsed = Number(form.deposit_amount);
      if (!Number.isFinite(parsed) || parsed < 0)
        next['deposit_amount'] = "Betrag muss eine Zahl ab 0 sein.";
      else if (Math.round(parsed * 100) !== parsed * 100)
        next['deposit_amount'] = "Maximal zwei Nachkommastellen.";
      else depositAmount = parsed;
    }

    if (!form.all_day) {
      const singleDay = !form.end_date || form.end_date === form.start_date;
      if (singleDay && form.start_time && form.end_time && form.end_time <= form.start_time)
        next['end_time'] = "Endzeit muss nach der Startzeit liegen.";
    }

    setErrors(next);
    if (Object.keys(next).length) return null;

    return {
      title: form.title.trim(),
      status: form.status,
      category_id: form.category_id,
      planning_area_ids: form.planning_area_ids,
      start_date: form.start_date,
      end_date: form.end_date || null,
      all_day: form.all_day,
      start_time: form.all_day ? null : form.start_time || null,
      end_time: form.all_day ? null : form.end_time || null,
      pax,
      notes: form.notes.trim() || null,
      deposit_received: form.deposit_received,
      deposit_amount: form.deposit_received ? depositAmount : null,
      deposit_received_at: form.deposit_received ? form.deposit_received_at || null : null,
      responsible_user_id: form.responsible_user_id || null,
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = validate();
    if (!input) return;
    if (!event) input.inbound_email_token = newToken;

    // Offline: only NEW entries are accepted, and they go into the local queue.
    if (!online) {
      if (event) {
        toast.error("Offline-Modus", {
          description: "Bestehende Einträge können offline nicht bearbeitet werden.",
        });
        return;
      }
      if (!userId) {
        toast.error("Offline-Speichern nicht möglich", {
          description: "Kein angemeldeter Benutzer erkannt.",
        });
        return;
      }
      try {
        await addPending(userId, input);
        if (pendingFiles.length) {
          toast.warning("Anhänge nicht möglich", {
            description:
              "Offline können keine Dateien hochgeladen werden. Bitte nach der Synchronisation erneut anhängen.",
          });
        }
        setPendingFiles([]);
        toast.success("Offline gespeichert", {
          description:
            "Der Eintrag wird synchronisiert, sobald wieder eine Verbindung besteht.",
        });
        onOpenChange(false);
      } catch (err) {
        toast.error("Offline-Speichern fehlgeschlagen", {
          description: err instanceof Error ? err.message : undefined,
        });
      }
      return;
    }

    try {
      const savedId = await save.mutateAsync(event ? { id: event.id, input } : { input });
      toast.success(event ? "Eintrag aktualisiert" : "Eintrag erstellt");

      // Attachments picked before the event existed are uploaded now.
      if (!event && pendingFiles.length && savedId) {
        try {
          for (const file of pendingFiles) await uploadAttachment(savedId, file);
          await queryClient.invalidateQueries({ queryKey: ["event_attachments", savedId] });
          toast.success(
            pendingFiles.length === 1 ? "Datei hochgeladen" : "Dateien hochgeladen",
          );
        } catch (err) {
          toast.error("Anhänge konnten nicht hochgeladen werden", {
            description: err instanceof Error ? err.message : undefined,
          });
        }
      }
      setPendingFiles([]);
      onOpenChange(false);
    } catch (err) {
      toast.error("Speichern fehlgeschlagen", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function onDelete() {
    if (!event) return;
    try {
      if (isLocal) {
        await removePending(event.id);
        setConfirmDelete(false);
        toast.success("Offline-Eintrag verworfen");
        onOpenChange(false);
        return;
      }
      await remove.mutateAsync(event.id);
      setConfirmDelete(false);
      toast.success("Eintrag gelöscht");
      onOpenChange(false);
    } catch (err) {
      toast.error("Löschen fehlgeschlagen", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <SheetHeader className="shrink-0 border-b border-border px-4 py-3">
            <SheetTitle className="text-sm font-semibold">
              {event ? (isLocal ? "Offline-Eintrag" : "Eintrag bearbeiten") : "Neuer Eintrag"}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {isLocal
                ? "Noch nicht synchronisiert – wird übertragen, sobald wieder eine Verbindung besteht."
                : readOnly
                  ? "Offline-Modus: bestehende Einträge können nur angesehen werden."
                  : "Event, Belegung oder Betriebsferien erfassen."}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pt-4 pb-6">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs">
                  Titel
                </Label>
                <Input
                  id="title"
                  value={form.title}
                  maxLength={160}
                  onChange={(e) => update({ title: e.target.value })}
                  placeholder="Hochzeit Müller"
                  className="h-8 text-sm"
                />
                <FieldError message={errors['title']} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Kategorie</Label>
                  <Select value={form.category_id} onValueChange={onCategoryChange}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Wählen…" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id} className="text-xs">
                          <span className="flex items-center gap-2">
                            <span
                              aria-hidden
                              className="size-2.5 rounded-[2px] border border-border"
                              style={{ backgroundColor: category.color }}
                            />
                            {category.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={errors['category_id']} />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select
                    value={form.status}
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

              <div className="space-y-1.5">
                <Label className="text-xs">Planungsbereiche</Label>
                <div className="grid grid-cols-1 gap-1 rounded-md border border-border p-1.5 sm:grid-cols-2">
                  {activeAreas.map((area) => {
                    const blocked = isHoliday && !HOLIDAY_ALLOWED_AREAS.includes(area.name);
                    const checked = form.planning_area_ids.includes(area.id);
                    return (
                      <label
                        key={area.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 rounded-sm px-1.5 py-1 text-xs transition-colors hover:bg-accent",
                          blocked && "cursor-not-allowed opacity-50 hover:bg-transparent",
                          checked && "bg-accent text-accent-foreground",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="size-3.5 accent-[var(--primary)]"
                          checked={checked}
                          disabled={blocked}
                          onChange={() => toggleArea(area.id)}
                        />
                        <span>{area.name}</span>
                      </label>
                    );
                  })}
                </div>
                {isHoliday ? (
                  <p className="text-[11px] text-muted-foreground">
                    Betriebsferien sind nur für {HOLIDAY_ALLOWED_AREAS.join(", ")} möglich.
                  </p>
                ) : null}
                <FieldError message={errors['planning_area_ids']} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Verantwortlich</Label>
                <Select
                  value={form.responsible_user_id || NONE}
                  onValueChange={(value) =>
                    update({ responsible_user_id: value === NONE ? "" : value })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Nicht zugewiesen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE} className="text-xs">
                      Nicht zugewiesen
                    </SelectItem>
                    {responsibleOptions.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id} className="text-xs">
                        {profileLabel(profile)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="start_date" className="text-xs">
                      Startdatum
                    </Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={form.start_date}
                      onChange={(e) => update({ start_date: e.target.value })}
                      className="h-8 text-xs"
                    />
                    <FieldError message={errors['start_date']} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="end_date" className="text-xs">
                      Enddatum
                    </Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={form.end_date}
                      min={form.start_date || undefined}
                      onChange={(e) => update({ end_date: e.target.value })}
                      className="h-8 text-xs"
                    />
                    <FieldError message={errors['end_date']} />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <Label htmlFor="all_day" className="text-xs">
                    Ganztägig
                  </Label>
                  <Switch
                    id="all_day"
                    checked={form.all_day}
                    onCheckedChange={(checked) => update({ all_day: checked })}
                  />
                </div>

                {!form.all_day ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="start_time" className="text-xs">
                        Startzeit
                      </Label>
                      <Input
                        id="start_time"
                        type="time"
                        value={form.start_time}
                        onChange={(e) => update({ start_time: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="end_time" className="text-xs">
                        Endzeit
                      </Label>
                      <Input
                        id="end_time"
                        type="time"
                        value={form.end_time}
                        onChange={(e) => update({ end_time: e.target.value })}
                        className="h-8 text-xs"
                      />
                      <FieldError message={errors['end_time']} />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pax" className="text-xs">
                  Personen
                </Label>
                <Input
                  id="pax"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={form.pax}
                  onChange={(e) => update({ pax: e.target.value })}
                  className="h-8 w-32 text-xs"
                />
                <FieldError message={errors['pax']} />
              </div>

              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="deposit_received"
                    checked={form.deposit_received}
                    onCheckedChange={(checked) =>
                      update(
                        checked === true
                          ? { deposit_received: true }
                          : {
                              deposit_received: false,
                              deposit_amount: "",
                              deposit_received_at: "",
                            },
                      )
                    }
                  />
                  <Label htmlFor="deposit_received" className="text-xs">
                    Anzahlung erhalten
                  </Label>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="deposit_amount" className="text-xs">
                    Betrag (CHF)
                  </Label>
                  <Input
                    id="deposit_amount"
                    type="number"
                    min={0}
                    step="0.05"
                    inputMode="decimal"
                    disabled={!form.deposit_received}
                    value={form.deposit_amount}
                    onChange={(e) => update({ deposit_amount: e.target.value })}
                    className="h-8 w-32 text-xs"
                  />
                  <FieldError message={errors['deposit_amount']} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="deposit_received_at" className="text-xs">
                    Zahlungseingang
                  </Label>
                  <Input
                    id="deposit_received_at"
                    type="date"
                    disabled={!form.deposit_received}
                    value={form.deposit_received_at}
                    onChange={(e) => update({ deposit_received_at: e.target.value })}
                    className="h-8 w-40 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs">
                  Bemerkungen
                </Label>
                <Textarea
                  id="notes"
                  rows={4}
                  maxLength={2000}
                  value={form.notes}
                  onChange={(e) => update({ notes: e.target.value })}
                  placeholder="Interne Bemerkungen zum Eintrag…"
                  className="text-sm"
                />
              </div>

              <CommunicationSection
                eventId={isLocal ? null : (event?.id ?? null)}
                inboundToken={event ? (event.inbound_email_token ?? null) : newToken}
                pendingFiles={pendingFiles}
                onPendingFilesChange={setPendingFiles}
              />


              {event ? (
                <p className="border-t border-border pt-3 text-[11px] text-muted-foreground">
                  Erstellt von{" "}
                  {event.created_by
                    ? profileLabel((profiles.data ?? []).find((p) => p.id === event.created_by)) ||
                      "Unbekannt"
                    : "Import"}{" "}
                  am {formatCreatedAt(event.created_at)}
                </p>
              ) : null}
            </div>


            <div className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {event ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                  disabled={!online && !isLocal}
                >
                  <Trash2 className="size-3.5" />
                  {isLocal ? "Verwerfen" : "Löschen"}
                </Button>
              ) : null}
              <div className="ml-auto flex items-center gap-2">
                {readOnly ? (
                  <span className="text-[11px] text-destructive">
                    Offline – nur Ansicht
                  </span>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => onOpenChange(false)}
                >
                  {readOnly ? "Schliessen" : "Abbrechen"}
                </Button>
                {!readOnly ? (
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8 text-xs"
                    disabled={save.isPending}
                  >
                    {save.isPending
                      ? "Speichern…"
                      : !online
                        ? "Offline speichern"
                        : "Speichern"}
                  </Button>
                ) : null}
              </div>
            </div>

          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eintrag löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {event?.title} wird dauerhaft gelöscht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void onDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>

      </AlertDialog>
    </>
  );
}
