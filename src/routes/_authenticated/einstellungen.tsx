import { createFileRoute, Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCategories } from "@/lib/master-data";
import { useMyProfile } from "@/lib/users";
import { UserAdmin } from "@/components/kundivent/user-admin";
import { PlanningAreaAdmin } from "@/components/kundivent/planning-area-admin";

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

function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge variant={active ? "secondary" : "outline"} className="text-[11px] font-normal">
      {active ? "Aktiv" : "Inaktiv"}
    </Badge>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

function Einstellungen() {
  const categories = useCategories();
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

      <Section title="Kategorien" hint={`${categories.data?.length ?? 0} Einträge`}>
        {categories.isPending ? (
          <p className="px-3 py-6 text-xs text-muted-foreground">Wird geladen…</p>
        ) : categories.isError ? (
          <p className="px-3 py-6 text-xs text-destructive">
            Kategorien konnten nicht geladen werden.
          </p>
        ) : (
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 w-16 text-xs">Nr.</TableHead>
                <TableHead className="h-8 text-xs">Name</TableHead>
                <TableHead className="h-8 w-32 text-xs">Farbe</TableHead>
                <TableHead className="h-8 w-28 text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.data.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="py-1.5 tabular-nums text-muted-foreground">
                    {category.sort_order}
                  </TableCell>
                  <TableCell className="py-1.5 font-medium">{category.name}</TableCell>
                  <TableCell className="py-1.5">
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        aria-hidden
                        className="size-3 rounded-[3px] border border-border"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="tabular-nums">{category.color}</span>
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <StatusBadge active={category.active} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}
