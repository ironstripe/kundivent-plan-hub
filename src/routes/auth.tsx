import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Anmelden – Kundivent" },
      {
        name: "description",
        content: "Anmeldung zur Eventplanung von Kundelfingerhof AG.",
      },
      { property: "og:title", content: "Anmelden – Kundivent" },
      {
        property: "og:description",
        content: "Anmeldung zur Eventplanung von Kundelfingerhof AG.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError("Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.");
      return;
    }
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-sm bg-primary text-xs font-semibold text-primary-foreground">
            K
          </span>
          <div>
            <p className="text-sm font-semibold tracking-tight">Kundivent</p>
            <p className="text-xs text-muted-foreground">Eventplanung Kundelfingerhof AG</p>
          </div>
        </div>

        <div className="rounded-md border border-border bg-card p-5">
          <h1 className="text-base font-semibold tracking-tight">Anmelden</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Zugang nur für Mitarbeitende der Kundelfingerhof AG. Konten werden von der
            Administration erstellt.
          </p>

          <form onSubmit={onSubmit} className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">
                E-Mail
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">
                Passwort
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {error ? <p className="text-xs text-destructive">{error}</p> : null}

            <Button type="submit" size="sm" className="h-8 w-full text-xs" disabled={loading}>
              {loading ? "Bitte warten…" : "Anmelden"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
