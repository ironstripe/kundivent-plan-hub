import { useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useCreateUser,
  useDeleteUser,
  useResetUserPassword,
  useSetUserActive,
  useUpdateUser,
  useUsers,
} from "@/lib/users";
import type { ManagedUser } from "@/lib/users.functions";

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Aktion fehlgeschlagen.";
}

type FormState = {
  display_name: string;
  email: string;
  password: string;
  active: boolean;
  is_admin: boolean;
};

const EMPTY: FormState = {
  display_name: "",
  email: "",
  password: "",
  active: true,
  is_admin: false,
};

const MIN_PASSWORD_LENGTH = 8;

function generatePassword() {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!?%+";
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function UserAdmin() {
  const users = useUsers(true);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const setActive = useSetUserActive();
  const resetPassword = useResetUserPassword();
  const deleteUser = useDeleteUser();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);

  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null);
  const [resetValue, setResetValue] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null);
  const [invalidField, setInvalidField] = useState<keyof FormState | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  function fail(field: keyof FormState, message: string) {
    setFormError(message);
    setInvalidField(field);
    toast.error(message);
    const ref =
      field === "display_name" ? nameRef : field === "email" ? emailRef : passwordRef;
    ref.current?.focus();
    errorRef.current?.scrollIntoView({ block: "nearest" });
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormError(null);
    setInvalidField(null);
    setOpen(true);
  }

  function openEdit(user: ManagedUser) {
    setEditing(user);
    setForm({
      display_name: user.display_name,
      email: user.email,
      password: "",
      active: user.active,
      is_admin: user.is_admin,
    });
    setFormError(null);
    setInvalidField(null);
    setOpen(true);
  }

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setInvalidField(null);

    if (!form.display_name.trim()) {
      fail("display_name", "Bitte einen Namen angeben.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      fail("email", "Bitte eine gültige E-Mail-Adresse angeben.");
      return;
    }
    if (!editing && form.password.length < MIN_PASSWORD_LENGTH) {
      fail(
        "password",
        `Das initiale Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein (aktuell ${form.password.length}).`,
      );
      return;
    }

    try {
      if (editing) {
        await updateUser.mutateAsync({
          id: editing.id,
          email: form.email,
          display_name: form.display_name,
          active: form.active,
          is_admin: form.is_admin,
        });
        toast.success("Benutzer gespeichert.");
      } else {
        await createUser.mutateAsync({
          email: form.email.trim(),
          password: form.password,
          display_name: form.display_name.trim(),
          active: form.active,
          is_admin: form.is_admin,
        });
        const list = await users.refetch();
        const created = list.data?.some(
          (u) => u.email.toLowerCase() === form.email.trim().toLowerCase(),
        );
        if (!created) {
          setFormError(
            "Der Benutzer konnte nicht bestätigt werden. Bitte Liste prüfen und erneut versuchen.",
          );
          toast.error("Benutzer erscheint nicht in der Liste.");
          return;
        }
        toast.success("Benutzer erstellt. Zugangsdaten separat weitergeben.");
      }
      setOpen(false);
    } catch (error) {
      const message = errorMessage(error);
      setFormError(message);
      toast.error(message);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError(null);
    if (resetValue.length < 8) {
      setResetError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    try {
      await resetPassword.mutateAsync({ id: resetTarget.id, password: resetValue });
      toast.success("Passwort zurückgesetzt. Benutzer muss es beim nächsten Login ändern.");
      setResetTarget(null);
      setResetValue("");
    } catch (error) {
      setResetError(errorMessage(error));
    }
  }

  async function toggleActive(user: ManagedUser) {
    try {
      await setActive.mutateAsync({ id: user.id, active: !user.active });
      toast.success(user.active ? "Benutzer deaktiviert." : "Benutzer aktiviert.");
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteUser.mutateAsync({ id: deleteTarget.id });
      toast.success("Benutzer gelöscht.");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <section className="rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-semibold tracking-tight">Benutzer</h2>
          <span className="text-xs text-muted-foreground">
            {users.data?.length ?? 0} Einträge
          </span>
        </div>
        <Button size="sm" className="h-7 px-2.5 text-xs" onClick={openCreate}>
          + Benutzer
        </Button>
      </div>

      <div className="overflow-x-auto">
        {users.isPending ? (
          <p className="px-3 py-6 text-xs text-muted-foreground">Wird geladen…</p>
        ) : users.isError ? (
          <p className="px-3 py-6 text-xs text-destructive">
            Benutzer konnten nicht geladen werden.
          </p>
        ) : (
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 text-xs">Name</TableHead>
                <TableHead className="h-8 text-xs">E-Mail</TableHead>
                <TableHead className="h-8 w-24 text-xs">Status</TableHead>
                <TableHead className="h-8 w-20 text-xs">Admin</TableHead>
                <TableHead className="h-8 w-36 text-xs">Passwort</TableHead>
                <TableHead className="h-8 w-64 text-xs text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="py-1.5 font-medium">
                    {user.display_name || "—"}
                  </TableCell>
                  <TableCell className="py-1.5 text-muted-foreground">{user.email}</TableCell>
                  <TableCell className="py-1.5">
                    <Badge
                      variant={user.active ? "secondary" : "outline"}
                      className="text-[11px] font-normal"
                    >
                      {user.active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1.5 text-xs">
                    {user.is_admin ? "Ja" : "Nein"}
                  </TableCell>
                  <TableCell className="py-1.5 text-[11px] text-muted-foreground">
                    {user.must_change_password ? "Wechsel erforderlich" : "Gesetzt"}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => openEdit(user)}
                      >
                        Bearbeiten
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => {
                          setResetTarget(user);
                          setResetValue("");
                          setResetError(null);
                        }}
                      >
                        Passwort
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => toggleActive(user)}
                      >
                        {user.active ? "Deaktivieren" : "Aktivieren"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px] text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(user)}
                      >
                        Löschen
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex h-full w-full flex-col overflow-hidden sm:max-w-md">
          <SheetHeader className="shrink-0">
            <SheetTitle className="text-base">
              {editing ? "Benutzer bearbeiten" : "Neuer Benutzer"}
            </SheetTitle>
            <SheetDescription className="text-xs">
              {editing
                ? "Name, E-Mail und Berechtigung anpassen."
                : "Zugangsdaten werden dem Benutzer separat mitgeteilt."}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={submitForm} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-6">
              <div className="space-y-1.5">
                <Label htmlFor="user-name" className="text-xs">
                  Name
                </Label>
                <Input
                  id="user-name"
                  ref={nameRef}
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  className={`h-8 text-sm ${invalidField === "display_name" ? "border-destructive" : ""}`}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="user-email" className="text-xs">
                  E-Mail
                </Label>
                <Input
                  id="user-email"
                  ref={emailRef}
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={`h-8 text-sm ${invalidField === "email" ? "border-destructive" : ""}`}
                />
              </div>
              {editing ? null : (
                <div className="space-y-1.5">
                  <Label htmlFor="user-password" className="text-xs">
                    Initiales Passwort
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      id="user-password"
                      ref={passwordRef}
                      type="text"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className={`h-8 text-sm ${
                        form.password.length > 0 && form.password.length < MIN_PASSWORD_LENGTH
                          ? "border-destructive"
                          : ""
                      }`}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 text-xs"
                      onClick={() => {
                        const pw = generatePassword();
                        setForm({ ...form, password: pw });
                        setInvalidField(null);
                        setFormError(null);
                        void navigator.clipboard?.writeText(pw).catch(() => undefined);
                        toast.success("Passwort generiert und kopiert.");
                      }}
                    >
                      Generieren
                    </Button>
                  </div>
                  <p
                    className={`text-[11px] ${
                      form.password.length < MIN_PASSWORD_LENGTH
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {form.password.length} / mind. {MIN_PASSWORD_LENGTH} Zeichen. Wird beim ersten
                    Login geändert.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between rounded-sm border border-border px-3 py-2">
                <Label htmlFor="user-active" className="text-xs">
                  Aktiv
                </Label>
                <Switch
                  id="user-active"
                  checked={form.active}
                  onCheckedChange={(v) => setForm({ ...form, active: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-sm border border-border px-3 py-2">
                <Label htmlFor="user-admin" className="text-xs">
                  Admin
                </Label>
                <Switch
                  id="user-admin"
                  checked={form.is_admin}
                  onCheckedChange={(v) => setForm({ ...form, is_admin: v })}
                />
              </div>

              {formError ? <p className="text-xs text-destructive">{formError}</p> : null}
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-border px-4 py-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setOpen(false)}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs"
                disabled={createUser.isPending || updateUser.isPending}
              >
                Speichern
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!resetTarget}
        onOpenChange={(v) => {
          if (!v) setResetTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Passwort zurücksetzen</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Neues temporäres Passwort für {resetTarget?.email}. Der Benutzer muss es beim
              nächsten Login ändern.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form onSubmit={submitReset} className="space-y-2">
            <Label htmlFor="reset-password" className="text-xs">
              Neues Passwort
            </Label>
            <Input
              id="reset-password"
              type="text"
              value={resetValue}
              onChange={(e) => setResetValue(e.target.value)}
              className="h-8 text-sm"
            />
            {resetError ? <p className="text-xs text-destructive">{resetError}</p> : null}
            <AlertDialogFooter className="pt-2">
              <AlertDialogCancel className="h-8 text-xs">Abbrechen</AlertDialogCancel>
              <Button
                type="submit"
                size="sm"
                className="h-8 text-xs"
                disabled={resetPassword.isPending}
              >
                Passwort setzen
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Benutzer löschen</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              {deleteTarget?.email} wird endgültig entfernt. Bestehende Einträge in Kundivent
              bleiben erhalten. Empfohlen wird stattdessen „Deaktivieren“.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 bg-destructive text-xs text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
