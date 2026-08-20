import { useEffect, useMemo, useState } from "react";
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
  HOLIDAY_ALLOWED_AREAS,
  HOLIDAY_CATEGORY,
  useDeleteEvent,
  useSaveEvent,
  type EventInput,
  type EventStatus,
  type EventWithRelations,
} from "@/lib/events";

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
  };
}

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
  const save = useSaveEvent();
  const remove = useDeleteEvent();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const activeAreas = useMemo(() => (areas.data ?? []).filter((a) => a.active), [areas.data]);
  const activeCategories = useMemo(
    () => (categories.data ?? []).filter((c) => c.active),
    [categories.data],
  );

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      event
        ? fromEvent(event)
        : {
            ...EMPTY,
            ...(defaultDate ? { start_date: defaultDate } : {}),
            ...(defaultAreaIds?.length ? { planning_area_ids: [...defaultAreaIds] } : {}),
            ...(defaultStatus ? { status: defaultStatus } : {}),
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event, defaultDate, defaultAreaIds?.join(","), defaultStatus]);


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
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = validate();
    if (!input) return;
    try {
      await save.mutateAsync(event ? { id: event.id, input } : { input });
      toast.success(event ? "Eintrag aktualisiert" : "Eintrag erstellt");
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
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border px-4 py-3">
            <SheetTitle className="text-sm font-semibold">
              {event ? "Eintrag bearbeiten" : "Neuer Eintrag"}
            </SheetTitle>
            <SheetDescription className="text-xs">
              Event, Belegung oder Betriebsferien erfassen.
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={onSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
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

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs">
                  Notiz
                </Label>
                <Textarea
                  id="notes"
                  rows={3}
                  maxLength={2000}
                  value={form.notes}
                  onChange={(e) => update({ notes: e.target.value })}
                  className="text-sm"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-border px-4 py-3">
              {event ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-3.5" />
                  Löschen
                </Button>
              ) : null}
              <div className="ml-auto flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => onOpenChange(false)}
                >
                  Abbrechen
                </Button>
                <Button type="submit" size="sm" className="h-8 text-xs" disabled={save.isPending}>
                  {save.isPending ? "Speichern…" : "Speichern"}
                </Button>
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
