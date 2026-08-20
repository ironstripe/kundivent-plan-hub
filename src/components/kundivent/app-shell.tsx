import { useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV = [
  { to: "/", label: "Übersicht", exact: true },
  { to: "/freie-termine", label: "Freie Termine", exact: false },
  { to: "/eintraege", label: "Einträge", exact: false },
  { to: "/einstellungen", label: "Einstellungen", exact: false },
] as const;

export function AppShell({ email, children }: { email?: string | null; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-4 px-3 sm:px-5">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-sm bg-primary text-[11px] font-semibold text-primary-foreground">
              K
            </span>
            <span className="text-sm font-semibold tracking-tight">Kundivent</span>
          </Link>

          <nav className="hidden items-center gap-0.5 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.exact }}
                className="rounded-sm px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground data-[status=active]:font-medium"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {email ? (
              <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span>
            ) : null}
            <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={signOut}>
              <LogOut className="size-3.5" />
              <span className="hidden sm:inline">Abmelden</span>
            </Button>
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7 md:hidden">
                  <Menu className="size-4" />
                  <span className="sr-only">Navigation</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 p-0">
                <nav className="flex flex-col gap-0.5 p-3 pt-10">
                  {NAV.map((item) => (
                    <Link
                      key={item.to}
                      to={item.to}
                      activeOptions={{ exact: item.exact }}
                      onClick={() => setOpen(false)}
                      className="rounded-sm px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground data-[status=active]:bg-accent data-[status=active]:text-accent-foreground data-[status=active]:font-medium"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-3 py-5 sm:px-5">{children}</main>
    </div>
  );
}

export function PagePlaceholder({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        <span className="text-xs text-muted-foreground">{description}</span>
      </div>
      <div className="rounded-md border border-dashed border-border bg-card px-5 py-10 text-center">
        <p className="text-sm font-medium">Noch nicht verfügbar</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">{phase}</p>
      </div>
    </div>
  );
}
