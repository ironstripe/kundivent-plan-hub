import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/kundivent/app-shell";
import { ForcePasswordChange } from "@/components/kundivent/force-password-change";
import { useMyProfile } from "@/lib/users";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function InactiveNotice() {
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    window.location.assign("/auth");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-md border border-border bg-card p-5 text-center">
        <h1 className="text-base font-semibold tracking-tight">Zugang deaktiviert</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Dieses Konto ist deaktiviert. Bitte wende dich an einen Administrator.
        </p>
        <Button size="sm" className="mt-4 h-8 text-xs" onClick={signOut}>
          Abmelden
        </Button>
      </div>
    </div>
  );
}

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  const profile = useMyProfile();

  if (profile.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-xs text-muted-foreground">Wird geladen…</p>
      </div>
    );
  }

  if (profile.data && !profile.data.active) return <InactiveNotice />;
  if (profile.data?.must_change_password) return <ForcePasswordChange email={user.email} />;

  return (
    <AppShell email={user.email ?? null} isAdmin={profile.data?.is_admin ?? false}>
      <Outlet />
    </AppShell>
  );
}
