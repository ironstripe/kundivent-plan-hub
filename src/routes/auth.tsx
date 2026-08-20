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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
    setMessage(null);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError("Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.");
        return;
      }
      navigate({ to: "/", replace: true });
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      if (data.session) {
        navigate({ to: "/", replace: true });
      } else {
        setMessage("Konto erstellt. Bitte E-Mail-Adresse bestätigen und danach anmelden.");
        setMode("signin");
      }
    }
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
          <h1 className="text-base font-semibold tracking-tight">
            {mode === "signin" ? "Anmelden" : "Konto erstellen"}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Zugang nur für Mitarbeitende der Kundelfingerhof AG.
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
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            {error ? <p className="text-xs text-destructive">{error}</p> : null}
            {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}

            <Button type="submit" size="sm" className="h-8 w-full text-xs" disabled={loading}>
              {loading ? "Bitte warten…" : mode === "signin" ? "Anmelden" : "Konto erstellen"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
              setMessage(null);
            }}
            className="mt-3 w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {mode === "signin" ? "Neues Konto erstellen" : "Bereits registriert? Anmelden"}
          </button>
        </div>
      </div>
    </div>
  );
}
