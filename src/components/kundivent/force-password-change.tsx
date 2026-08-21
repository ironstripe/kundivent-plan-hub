import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { completePasswordChange } from "@/lib/users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForcePasswordChange({ email }: { email?: string | null }) {
  const queryClient = useQueryClient();
  const complete = useServerFn(completePasswordChange);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (password !== confirm) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setLoading(false);
      setError(updateError.message || "Passwort konnte nicht gespeichert werden.");
      return;
    }
    try {
      await complete({});
    } catch {
      setLoading(false);
      setError("Passwort wurde geändert, das Profil konnte aber nicht aktualisiert werden.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-sm bg-primary text-xs font-semibold text-primary-foreground">
            K
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight">Kundivent</p>
            <p className="text-xs text-muted-foreground">{email ?? "Passwort ändern"}</p>
          </div>
        </div>

        <div className="rounded-md border border-border bg-card p-5">
          <h1 className="text-base font-semibold tracking-tight">Passwort ändern</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Bitte setze ein persönliches Passwort, bevor du Kundivent nutzt.
          </p>

          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs">
                Neues Passwort
              </Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs">
                Passwort bestätigen
              </Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {error ? <p className="text-xs text-destructive">{error}</p> : null}

            <Button type="submit" size="sm" className="h-8 w-full text-xs" disabled={loading}>
              {loading ? "Bitte warten…" : "Passwort speichern"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
