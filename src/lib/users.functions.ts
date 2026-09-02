import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UserRole = "viewer" | "editor" | "admin";

export type ManagedUser = {
  id: string;
  email: string;
  display_name: string;
  active: boolean;
  role: UserRole;
  is_admin: boolean;
  must_change_password: boolean;
  /** Planning areas this user may delete entries in (editors only). */
  delete_area_ids: string[];
};

function assertPassword(password: string) {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("Das Passwort muss mindestens 8 Zeichen lang sein.");
  }
}

function normalizeEmail(email: string) {
  const value = String(email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("Bitte eine gültige E-Mail-Adresse angeben.");
  }
  return value;
}

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("profiles")
    .select("role, active")
    .eq("id", context.userId)
    .maybeSingle();
  if (error) throw new Error("Berechtigung konnte nicht geprüft werden.");
  if (!data?.active) throw new Error("Dieser Benutzer ist deaktiviert.");
  if (data?.role !== "admin") throw new Error("Keine Berechtigung für die Benutzerverwaltung.");
}

function assertRole(role: string): asserts role is UserRole {
  if (!["viewer", "editor", "admin"].includes(role)) {
    throw new Error("Ungültige Rolle.");
  }
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function activeAdminCount(db: any, excludeId?: string) {
  let query = db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("active", true);
  if (excludeId) query = query.neq("id", excludeId);
  const { count, error } = await query;
  if (error) throw new Error("Administratoren konnten nicht geprüft werden.");
  return count ?? 0;
}

async function guardLastAdmin(db: any, targetId: string, stillActiveAdmin: boolean) {
  if (stillActiveAdmin) return;
  const remaining = await activeAdminCount(db, targetId);
  if (remaining === 0) {
    throw new Error("Der letzte aktive Administrator kann nicht deaktiviert oder entfernt werden.");
  }
}

/** Delete permissions are only meaningful for editors; other roles get none. */
async function syncDeletePermissions(
  db: any,
  profileId: string,
  role: UserRole,
  areaIds: string[],
) {
  const wanted = role === "editor" ? Array.from(new Set(areaIds)) : [];
  const { error: clearError } = await db
    .from("profile_planning_area_permissions")
    .delete()
    .eq("profile_id", profileId);
  if (clearError) throw new Error("Löschrechte konnten nicht gespeichert werden.");
  if (!wanted.length) return;
  const { error } = await db.from("profile_planning_area_permissions").insert(
    wanted.map((planning_area_id) => ({
      profile_id: profileId,
      planning_area_id,
      can_delete: true,
    })),
  );
  if (error) throw new Error("Löschrechte konnten nicht gespeichert werden.");
}

/** Minimal, non-sensitive directory of all users (name pickers, creator labels). */
export const listDirectory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ id: string; display_name: string; active: boolean }[]> => {
    const db = await admin();
    const { data, error } = await db
      .from("profiles")
      .select("id, display_name, active")
      .order("display_name", { ascending: true });
    if (error) throw new Error("Benutzerliste konnte nicht geladen werden.");
    return data ?? [];
  });

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await requireAdmin(context as any);
    const db = await admin();

    const { data: profiles, error } = await db
      .from("profiles")
      .select("id, display_name, active, role, must_change_password")
      .order("display_name", { ascending: true });
    if (error) throw new Error("Benutzer konnten nicht geladen werden.");

    const { data: authList, error: authError } = await db.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (authError) throw new Error("Benutzer konnten nicht geladen werden.");

    const { data: perms, error: permError } = await db
      .from("profile_planning_area_permissions")
      .select("profile_id, planning_area_id, can_delete")
      .eq("can_delete", true);
    if (permError) throw new Error("Löschrechte konnten nicht geladen werden.");

    const emails = new Map(authList.users.map((u) => [u.id, u.email ?? ""]));
    return (profiles ?? []).map((p) => ({
      id: p.id,
      email: emails.get(p.id) ?? "",
      display_name: p.display_name,
      active: p.active,
      role: p.role as UserRole,
      is_admin: p.role === "admin",
      must_change_password: p.must_change_password,
      delete_area_ids: (perms ?? [])
        .filter((x) => x.profile_id === p.id)
        .map((x) => x.planning_area_id),
    }));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    email: string;
    password: string;
    display_name: string;
    active: boolean;
    role: UserRole;
    delete_area_ids?: string[];
  }) => input)
  .handler(async ({ data, context }) => {
    await requireAdmin(context as any);
    assertRole(data.role);
    assertPassword(data.password);
    const email = normalizeEmail(data.email);
    const db = await admin();

    const { data: created, error } = await db.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.display_name?.trim() ?? "" },
    });
    if (error || !created.user) {
      throw new Error(
        error?.message?.includes("already")
          ? "Diese E-Mail-Adresse wird bereits verwendet."
          : "Benutzer konnte nicht erstellt werden.",
      );
    }

    const { error: profileError } = await db
      .from("profiles")
      .upsert({
        id: created.user.id,
        display_name: data.display_name?.trim() ?? "",
        active: data.active,
        role: data.role,
        must_change_password: true,
      });
    if (profileError) throw new Error("Profil konnte nicht gespeichert werden.");
    await syncDeletePermissions(db, created.user.id, data.role, data.delete_area_ids ?? []);
    return { id: created.user.id };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id: string;
    email: string;
    display_name: string;
    active: boolean;
    role: UserRole;
    delete_area_ids?: string[];
  }) => input)
  .handler(async ({ data, context }) => {
    await requireAdmin(context as any);
    assertRole(data.role);
    const email = normalizeEmail(data.email);
    const db = await admin();

    await guardLastAdmin(db, data.id, data.active && data.role === "admin");

    const { error: authError } = await db.auth.admin.updateUserById(data.id, {
      email,
      email_confirm: true,
      user_metadata: { display_name: data.display_name?.trim() ?? "" },
    });
    if (authError) {
      throw new Error(
        authError.message?.includes("already")
          ? "Diese E-Mail-Adresse wird bereits verwendet."
          : "E-Mail-Adresse konnte nicht aktualisiert werden.",
      );
    }

    const { error } = await db
      .from("profiles")
      .update({
        display_name: data.display_name?.trim() ?? "",
        active: data.active,
        role: data.role,
      })
      .eq("id", data.id);
    if (error) throw new Error("Benutzer konnte nicht gespeichert werden.");
    await syncDeletePermissions(db, data.id, data.role, data.delete_area_ids ?? []);
    return { ok: true };
  });

export const setUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; active: boolean }) => input)
  .handler(async ({ data, context }) => {
    await requireAdmin(context as any);
    const db = await admin();
    await guardLastAdmin(db, data.id, data.active);
    const { error } = await db.from("profiles").update({ active: data.active }).eq("id", data.id);
    if (error) throw new Error("Status konnte nicht geändert werden.");
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; password: string }) => input)
  .handler(async ({ data, context }) => {
    await requireAdmin(context as any);
    assertPassword(data.password);
    const db = await admin();

    const { error: authError } = await db.auth.admin.updateUserById(data.id, {
      password: data.password,
    });
    if (authError) throw new Error("Passwort konnte nicht gesetzt werden.");

    const { error } = await db
      .from("profiles")
      .update({ must_change_password: true })
      .eq("id", data.id);
    if (error) throw new Error("Profil konnte nicht aktualisiert werden.");
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    await requireAdmin(context as any);
    const db = await admin();
    await guardLastAdmin(db, data.id, false);
    const { error } = await db.auth.admin.deleteUser(data.id);
    if (error) throw new Error("Benutzer konnte nicht gelöscht werden.");
    return { ok: true };
  });

export const completePasswordChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ctx = context as any;
    const db = await admin();
    const { error } = await db
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", ctx.userId);
    if (error) throw new Error("Profil konnte nicht aktualisiert werden.");
    return { ok: true };
  });
