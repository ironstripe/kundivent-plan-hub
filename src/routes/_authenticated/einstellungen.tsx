import { createFileRoute, Link } from "@tanstack/react-router";
import { useMyProfile } from "@/lib/users";
import { UserAdmin } from "@/components/kundivent/user-admin";
import { PlanningAreaAdmin } from "@/components/kundivent/planning-area-admin";
import { CategoryAdmin } from "@/components/kundivent/category-admin";
import { InboundEmailLog } from "@/components/kundivent/inbound-email-log";


export const Route = createFileRoute("/_authenticated/einstellungen")({
  head: () => ({
    meta: [
      { title: "Einstellungen – Kundivent" },
      {
        name: "description",
        content: "Stammdaten von Kundivent: Planungsbereiche und Kategorien.",
      },
      { property: "og:title", content: "Einstellungen – Kundivent" },
      {
        property: "og:description",
        content: "Stammdaten von Kundivent: Planungsbereiche und Kategorien.",
      },
    ],
  }),
  component: Einstellungen,
});

function Einstellungen() {
  const profile = useMyProfile();
  const isAdmin = profile.data?.is_admin ?? false;


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-base font-semibold tracking-tight">Einstellungen</h1>
        <span className="text-xs text-muted-foreground">
          Stammdaten von Kundivent
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-border bg-card px-3 py-2">
        <div>
          <p className="text-xs font-medium">Excel-Migration</p>
          <p className="text-[11px] text-muted-foreground">
            Einmaliges Migrationswerkzeug für die bestehende Excel-Eventplanung.
          </p>
        </div>
        <Link
          to="/migration"
          className="rounded-sm border border-border px-2.5 py-1 text-xs transition-colors hover:bg-accent"
        >
          Öffnen
        </Link>
      </div>

      {isAdmin ? <UserAdmin /> : null}


      <PlanningAreaAdmin canManage={isAdmin} />

      <CategoryAdmin canManage={isAdmin} />

      {isAdmin ? <InboundEmailLog /> : null}



    </div>
  );
}
