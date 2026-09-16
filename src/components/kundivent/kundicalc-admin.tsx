import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDeleteIntegrationMapping,
  useIntegrationUserMap,
  useSaveIntegrationMapping,
} from "@/lib/kundicalc";
import { profileLabel, useProfiles } from "@/lib/users";

/**
 * Explicit mapping between KundiCalc users and Kundivent users.
 * Without a mapping a KundiCalc request is rejected — no auto-matching.
 */
export function KundiCalcAdmin() {
  const mappings = useIntegrationUserMap();
  const profiles = useProfiles();
  const save = useSaveIntegrationMapping();
  const remove = useDeleteIntegrationMapping();

  const [sourceActorId, setSourceActorId] = useState("");
  const [profileId, setProfileId] = useState("");
  const [note, setNote] = useState("");

  const profileById = new Map((profiles.data ?? []).map((p) => [p.id, p]));

  async function add() {
    try {
      await save.mutateAsync({
        source_actor_id: sourceActorId,
        profile_id: profileId,
        active: true,
        note: note.trim() || null,
      });
      setSourceActorId("");
      setProfileId("");
      setNote("");
      toast.success("Zuordnung gespeichert.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    }
  }

  return (
    <section className="space-y-3 rounded-md border border-border bg-card p-3">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">KundiCalc-Übergabe</h2>
        <p className="text-[11px] text-muted-foreground">
          Zuordnung von KundiCalc-Benutzern zu Kundivent-Benutzern. Ohne Zuordnung wird eine
          Übergabe abgelehnt. Schreibrechte erhalten nur aktive Bearbeiter und Administratoren.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="kc-actor" className="text-xs">
            KundiCalc-Benutzerkennung
          </Label>
          <Input
            id="kc-actor"
            value={sourceActorId}
            onChange={(e) => setSourceActorId(e.target.value)}
            placeholder="z. B. 7f0c…"
            className="h-8 w-56 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Kundivent-Benutzer</Label>
          <Select value={profileId} onValueChange={setProfileId}>
            <SelectTrigger className="h-8 w-56 text-xs">
              <SelectValue placeholder="Benutzer wählen" />
            </SelectTrigger>
            <SelectContent>
              {(profiles.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {profileLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="kc-note" className="text-xs">
            Notiz
          </Label>
          <Input
            id="kc-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="h-8 w-48 text-xs"
          />
        </div>
        <Button
          type="button"
          size="sm"
          className="h-8 text-xs"
          disabled={!sourceActorId.trim() || !profileId || save.isPending}
          onClick={() => void add()}
        >
          Hinzufügen
        </Button>
      </div>

      <div className="space-y-1.5">
        {(mappings.data ?? []).length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Noch keine Zuordnungen erfasst.</p>
        ) : null}
        {(mappings.data ?? []).map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center gap-2 rounded-sm border border-border px-2.5 py-1.5 text-xs"
          >
            <span className="font-mono text-[11px]">{row.source_actor_id}</span>
            <span className="text-muted-foreground">→</span>
            <span>{profileLabel(profileById.get(row.profile_id)) || "Unbekannt"}</span>
            {row.note ? (
              <span className="text-[11px] text-muted-foreground">({row.note})</span>
            ) : null}
            <div className="ml-auto flex items-center gap-2">
              <Switch
                checked={row.active}
                onCheckedChange={(checked) =>
                  void save
                    .mutateAsync({
                      id: row.id,
                      source_actor_id: row.source_actor_id,
                      profile_id: row.profile_id,
                      active: checked,
                      note: row.note,
                    })
                    .catch(() => toast.error("Änderung fehlgeschlagen."))
                }
              />
              <span className="text-[11px] text-muted-foreground">
                {row.active ? "Aktiv" : "Inaktiv"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() =>
                  void remove
                    .mutateAsync(row.id)
                    .catch(() => toast.error("Löschen fehlgeschlagen."))
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
