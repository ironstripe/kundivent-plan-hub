import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { EventAttachment } from "@/lib/attachments";

export type EventEmail = Tables<"event_emails">;

export type EventEmailWithAttachments = EventEmail & {
  attachments: EventAttachment[];
};

export function eventEmailsQueryKey(eventId: string) {
  return ["event_emails", eventId] as const;
}

/** Archived e-mails for one event, newest first, with their attachments. */
export function useEventEmails(eventId: string | null | undefined) {
  return useQuery({
    queryKey: eventEmailsQueryKey(eventId ?? "none"),
    enabled: Boolean(eventId),
    queryFn: async (): Promise<EventEmailWithAttachments[]> => {
      const { data, error } = await supabase
        .from("event_emails")
        .select("*, event_attachments(*)")
        .eq("event_id", eventId!)
        .order("received_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => {
        const { event_attachments, ...email } = row as EventEmail & {
          event_attachments: EventAttachment[] | null;
        };
        return { ...email, attachments: event_attachments ?? [] };
      });
    },
  });
}

/** First meaningful line of the mail, used as a compact preview. */
export function emailPreview(email: EventEmail, maxLength = 120): string {
  const source =
    email.text_body?.trim() ||
    (email.html_body ? email.html_body.replace(/<[^>]+>/g, " ") : "") ||
    "";
  const text = source.replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export function senderLabel(email: EventEmail) {
  return email.from_name ? `${email.from_name} <${email.from_address}>` : email.from_address;
}
