import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useDeletePlanningArea,
  usePlanningAreas,
  useSavePlanningArea,
  type PlanningArea,
} from "@/lib/master-data";

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Aktion fehlgeschlagen.";
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "secondary" : "outline"} className="text-[11px] font-normal">
      {active ? "Aktiv" : "Inaktiv"}
    </Badge>
  );
}

type FormState = { name: string; sort_order: string; active: boolean };

export function PlanningAreaAdmin({ canManage }: { canManage: boolean }) {
  const areas = usePlanningAreas();
  const save = useSavePlanningArea();
  const remove = useDeletePlanningArea();

  const [editing, setEditing] = useState<PlanningArea | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ name: "", sort_order: "0", active: true });
  const [deleteTarget, setDeleteTarget] = useState<PlanningArea | null>(null);

  const list = areas.data ?? [];

  function openNew() {
    const nextOrder = list.reduce((max, a) => Math.max(max, a.sort_order), -1) + 1;
    setEditing(null);
    setForm({ name: "", sort_order: String(nextOrder), active: true });
    setOpen(true);
  }

  function openEdit(area: PlanningArea) {
    setEditing(area);
    setForm({ name: area.name, sort_order: String(area.sort_order), active: area.active });
    setOpen(true);
  }

  async function submit() {
    const name = form.name.trim();
    if (!name) {
      toast.error("Bitte einen Namen erfassen.");
      return;
    }
    const duplicate = list.some(
      (a) => a.id !== editing?.id && a.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) {
      toast.error("Es gibt bereits einen Bereich mit diesem Namen.");
      return;
    }
    const sortOrder = Number(form.sort_order);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      toast.error("Die Nummer muss eine ganze Zahl ab 0 sein.");
      return;
    }

    try {
      await save.mutateAsync({
        ...(editing ? { id: editing.id } : {}),
        input: { name, sort_order: sortOrder, active: form.active },
      });
      toast.success(editing ? "Bereich gespeichert." : "Bereich hinzugefügt.");
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function confirmDelete() {
    const target = deleteTarget;
    if (!target) return;
    try {
      await remove.mutateAsync(target.id);
      toast.success("Bereich gelöscht.");
      setDeleteTarget(null);
    } catch (error) {
      const message = errorMessage(error);
      setDeleteTarget(null);
      toast.error(message, {
        action: target.active
          ? {
              label: "Deaktivieren",
              onClick: () => {
                void save
                  .mutateAsync({
                    id: target.id,
                    input: {
                      name: target.name,
                      sort_order: target.sort_order,
                      active: false,
                    },
                  })
                  .then(() => toast.success("Bereich deaktiviert."))
                  .catch((e) => toast.error(errorMessage(e)));
              },
            }
          : undefined,
      });
    }
  }

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold tracking-tight">Planungsbereiche</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{list.length} Einträge</span>
          {canManage ? (
            <Button size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={openNew}>
              <Plus className="size-3.5" />
              Bereich hinzufügen
            </Button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        {areas.isPending ? (
          <p className="px-3 py-6 text-xs text-muted-foreground">Wird geladen…</p>
        ) : areas.isError ? (
          <p className="px-3 py-6 text-xs text-destructive">
            Planungsbereiche konnten nicht geladen werden.
          </p>
        ) : (
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 w-16 text-xs">Nr.</TableHead>
                <TableHead className="h-8 text-xs">Name</TableHead>
                <TableHead className="h-8 w-28 text-xs">Status</TableHead>
                {canManage ? <TableHead className="h-8 w-28 text-xs">Aktionen</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((area) => (
                <TableRow key={area.id}>
                  <TableCell className="py-1.5 tabular-nums text-muted-foreground">
                    {area.sort_order}
                  </TableCell>
                  <TableCell className="py-1.5 font-medium">{area.name}</TableCell>
                  <TableCell className="py-1.5">
                    <StatusBadge active={area.active} />
                  </TableCell>
                  {canManage ? (
                    <TableCell className="py-1.5">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => openEdit(area)}
                        >
                          <Pencil className="size-3.5" />
                          <span className="sr-only">Bearbeiten</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(area)}
                        >
                          <Trash2 className="size-3.5" />
                          <span className="sr-only">Löschen</span>
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editing ? "Bereich bearbeiten" : "Neuer Planungsbereich"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Die Farbe eines Bereichs wird automatisch aus dem Namen abgeleitet. Neue Bereiche mit
              unbekanntem Namen erhalten die neutrale Standardfarbe.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="area-name" className="text-xs">
                Name
              </Label>
              <Input
                id="area-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="z. B. Event / Pavillon"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="area-order" className="text-xs">
                Reihenfolge (Nr.)
              </Label>
              <Input
                id="area-order"
                type="number"
                min={0}
                step={1}
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <p className="text-xs font-medium">Aktiv</p>
                <p className="text-[11px] text-muted-foreground">
                  Inaktive Bereiche stehen bei neuen Einträgen nicht mehr zur Auswahl.
                </p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
            <Button size="sm" onClick={submit} disabled={save.isPending}>
              {save.isPending ? "Speichern…" : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => (o ? null : setDeleteTarget(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bereich löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              „{deleteTarget?.name}“ wird dauerhaft entfernt. Das ist nur möglich, wenn der Bereich
              in keinem Eintrag verwendet wird.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
