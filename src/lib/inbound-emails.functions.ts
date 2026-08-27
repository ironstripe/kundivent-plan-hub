import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Admin action: fetch attachments of already archived inbound e-mails from
 * Resend and store the ones that are still missing.
 */
export const backfillEmailAttachments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile, error: profileError } = await context.supabase
      .from("profiles")
      .select("is_admin, active")
      .eq("id", context.userId)
      .maybeSingle();
    if (profileError) throw new Error("Berechtigung konnte nicht geprüft werden.");
    if (!profile?.active || !profile?.is_admin) throw new Error("Keine Berechtigung.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { fetchFullEmail, storeAttachments } = await import(
      "@/lib/inbound-attachments.server"
    );

    const { data: emails, error } = await supabaseAdmin
      .from("event_emails")
      .select("id, event_id, resend_email_id, event_attachments(id)")
      .order("received_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    let checked = 0;
    let stored = 0;
    const problems: string[] = [];

    for (const row of emails ?? []) {
      const existing = (row as { event_attachments?: unknown[] }).event_attachments ?? [];
      if (existing.length) continue;
      checked += 1;
      const full = await fetchFullEmail(row.resend_email_id, {});
      if (!full.attachments?.length) continue;
      const result = await storeAttachments(supabaseAdmin, {
        eventId: row.event_id,
        emailRowId: row.id,
        resendEmailId: row.resend_email_id,
        attachments: full.attachments,
      });
      stored += result.stored;
      if (result.failed && result.detail) problems.push(result.detail);
    }

    return { checked, stored, problems };
  });
