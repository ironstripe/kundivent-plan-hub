import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  useDeleteIntegrationMapping,
  useIntegrationUserMap,
  useSaveIntegrationMapping,
  type IntegrationUserMapping,
} from "@/lib/kundicalc";
import type { ManagedUser } from "@/lib/users.functions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  return "Aktion fehlgeschlagen.";
}

/**
 * KundiCalc mapping for a single Kundivent user.
 * Uses exactly the same records and mutations as Einstellungen → KundiCalc-Übergabe.
 */
export function KundiCalcUserLink({ user }: { user: ManagedUser }) {
  const mappings = useIntegrationUserMap();
  const save = useSaveIntegrationMapping();
  const remove = useDeleteIntegrationMapping();

  const own = useMemo(
    () => (mappings.data ?? []).filter((m) => m.profile_id === user.id),
    [mappings.data, user.id],
  );
  const current: IntegrationUserMapping | null = own.length === 1 ? own[0]! : null;

  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<null | { kind: "replace" | "remove"; next: string }>(null);

  useEffect(() => {
    setValue(current?.source_actor_id ?? "");
    setError(null);
  }, [current?.id, current?.source_actor_id, user.id]);

  const eligible = user.active && (user.role === "editor" || user.role === "admin");

  function validate(): string | null {
    const next = value.trim();
    if (!next) {
      setError("Bitte eine KundiCalc-ID angeben.");
      return null;
    }
    if (!UUID_RE.test(next)) {
      setError("Ungültige KundiCalc-ID. Erwartet wird eine UUID.");
      return null;
    }
    const clash = (mappings.data ?? []).find(
      (m) =>
        m.source_actor_id.toLowerCase() === next.toLowerCase() && m.profile_id !== user.id,
    );
    if (clash) {
      setError(
        "Diese KundiCalc-ID ist bereits einem anderen Kundivent-Benutzer zugeordnet. Bitte zuerst dort entfernen (Einstellungen → KundiCalc-Übergabe).",
      );
      return null;
    }
    setError(null);
    return next;
  }

  async function persist(next: string) {
    try {
      // Concurrency: re-read before writing so a change made elsewhere is not overwritten.
      const fresh = await mappings.refetch();
      const rows = (fresh.data ?? []).filter((m) => m.profile_id === user.id);
      if (current && (rows.length !== 1 || rows[0]!.id !== current.id)) {
        setError("Die Zuordnung wurde zwischenzeitlich geändert. Bitte Ansicht neu laden.");
        return;
      }
      const conflict = (fresh.data ?? []).find(
        (m) => m.source_actor_id.toLowerCase() === next.toLowerCase() && m.profile_id !== user.id,
      );
      if (conflict) {
        setError("Diese KundiCalc-ID ist bereits einem anderen Kundivent-Benutzer zugeordnet.");
        return;
      }
      await save.mutateAsync({
        ...(current ? { id: current.id } : {}),
        source_actor_id: next,
        profile_id: user.id,
        // Bestehender Aktiv-Status bleibt unverändert; neue Zuordnungen sind aktiv.
        active: current ? current.active : true,
        note: current?.note ?? null,
      });
      toast.success("KundiCalc-Verknüpfung gespeichert.");
    } catch (e) {
      const message = errorMessage(e);
      setError(message);
      toast.error(message);
    }
  }

  function onSave() {
    const next = validate();
    if (!next) return;
    if (current && current.source_actor_id !== next) {
      setConfirm({ kind: "replace", next });
      return;
    }
    if (current && current.source_actor_id === next) {
      toast.success("Keine Änderung.");
      return;
    }
    void persist(next);
  }

  async function onRemove() {
    if (!current) return;
    try {
      await remove.mutateAsync(current.id);
      setValue("");
      setError(null);
      toast.success("Verknüpfung entfernt.");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <div className="space-y-2 rounded-sm border border-border px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-medium">KundiCalc-Verknüpfung</p>
        {own.length === 0 ? (
          <Badge variant="outline" className="text-[11px] font-normal">
            Keine Verknüpfung
          </Badge>
        ) : (
          <Badge
            variant={own.some((m) => m.active) ? "secondary" : "outline"}
            className="text-[11px] font-normal"
          >
            {own.some((m) => m.active) ? "Zuordnung aktiv" : "Zuordnung inaktiv"}
          </Badge>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Zuordnung für {user.display_name || "diesen Benutzer"} ({user.email}).
      </p>

      {own.length > 1 ? (
        <div className="space-y-1">
          <p className="text-[11px] text-destructive">
            Für diesen Benutzer bestehen mehrere Zuordnungen. Bitte in Einstellungen →
            „KundiCalc-Übergabe“ bereinigen; hier wird nichts überschrieben.
          </p>
          {own.map((m) => (
            <p key={m.id} className="font-mono text-[11px] text-muted-foreground">
              {m.source_actor_id} — {m.active ? "aktiv" : "inaktiv"}
            </p>
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`kc-id-${user.id}`} className="text-xs">
              KundiCalc-ID
            </Label>
            <Input
              id={`kc-id-${user.id}`}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Benutzer-ID aus KundiCalc einfügen"
              className={`h-8 font-mono text-xs ${error ? "border-destructive" : ""}`}
            />
            <p className="text-[11px] text-muted-foreground">
              Die ID findest du in der KundiCalc-Benutzerverwaltung. Nur erforderlich, wenn diese
              Person Events an Kundivent übergibt.
            </p>
          </div>

          {error ? <p className="text-[11px] text-destructive">{error}</p> : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              disabled={save.isPending}
              onClick={onSave}
            >
              Verknüpfung speichern
            </Button>
            {current ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] text-destructive hover:text-destructive"
                disabled={remove.isPending}
                onClick={() => setConfirm({ kind: "remove", next: "" })}
              >
                Verknüpfung entfernen
              </Button>
            ) : null}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Eine gültige ID bestätigt nicht die Identität der Person und belegt keine
            funktionierende Verbindung.
          </p>
        </>
      )}

      {!eligible ? (
        <p className="text-[11px] text-muted-foreground">
          Die Zuordnung allein berechtigt nicht zur Übergabe. Dafür ist ein aktiver Benutzer mit
          Bearbeiter- oder Adminrechten erforderlich.
        </p>
      ) : null}

      <AlertDialog
        open={!!confirm}
        onOpenChange={(v) => {
          if (!v) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">
              {confirm?.kind === "remove" ? "Verknüpfung entfernen" : "Verknüpfung ersetzen"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Betrifft {user.display_name || "diesen Benutzer"} ({user.email}).
              {confirm?.kind === "remove"
                ? " Ohne Zuordnung werden künftige KundiCalc-Anfragen mit dieser Kennung abgelehnt. Bereits erfolgte Übergaben und deren Quittungen bleiben unverändert."
                : ` Die bisherige Kennung ${current?.source_actor_id ?? ""} wird durch ${confirm?.next ?? ""} ersetzt. Bereits erfolgte Übergaben bleiben unverändert.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-xs"
              onClick={(e) => {
                e.preventDefault();
                const action = confirm;
                setConfirm(null);
                if (!action) return;
                if (action.kind === "remove") void onRemove();
                else void persist(action.next);
              }}
            >
              {confirm?.kind === "remove" ? "Entfernen" : "Ersetzen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
