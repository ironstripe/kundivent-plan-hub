import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile } from "@/lib/users";

export type UserRole = "viewer" | "editor" | "admin";

export const ROLE_OPTIONS: { value: UserRole; label: string; hint: string }[] = [
  {
    value: "viewer",
    label: "Betrachter",
    hint: "Kann Kundivent ansehen, aber keine Einträge verändern.",
  },
  {
    value: "editor",
    label: "Bearbeiter",
    hint: "Kann Einträge erstellen und bearbeiten. Löschrechte können separat vergeben werden.",
  },
  {
    value: "admin",
    label: "Administrator",
    hint: "Vollzugriff inklusive Benutzerverwaltung und Löschen.",
  },
];

export const roleLabel = (role: UserRole | null | undefined) =>
  ROLE_OPTIONS.find((r) => r.value === role)?.label ?? "—";

/** Planning areas the signed-in user may delete entries in (RLS scopes to own rows). */
export const myDeleteAreasQuery = queryOptions({
  queryKey: ["my-delete-areas"],
  queryFn: async (): Promise<string[]> => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return [];
    const { data, error } = await supabase
      .from("profile_planning_area_permissions")
      .select("planning_area_id, can_delete")
      .eq("profile_id", auth.user.id)
      .eq("can_delete", true);
    if (error) throw error;
    return (data ?? []).map((row) => row.planning_area_id);
  },
  staleTime: 60 * 1000,
});

/** Role + delete authorisation for the signed-in user. Mirrors the database rules. */
export function usePermissions() {
  const profile = useMyProfile();
  const deleteAreas = useQuery(myDeleteAreasQuery);

  const role = (profile.data?.role ?? null) as UserRole | null;
  const active = profile.data?.active ?? false;
  const isAdmin = active && role === "admin";
  const isEditor = active && role === "editor";

  return {
    role,
    isAdmin,
    isEditor,
    /** Create and edit entries. */
    canEdit: isAdmin || isEditor,
    /** Delete a specific entry: admin always, editor only with rights for ALL areas. */
    canDeleteEvent(event: { planning_area_ids?: string[] } | null | undefined) {
      if (isAdmin) return true;
      if (!isEditor || !event) return false;
      const areas = event.planning_area_ids ?? [];
      if (areas.length === 0) return false;
      const allowed = deleteAreas.data ?? [];
      return areas.every((id) => allowed.includes(id));
    },
  };
}
