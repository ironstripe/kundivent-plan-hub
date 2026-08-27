/**
 * Fetching and storing attachments of inbound (forwarded) e-mails.
 *
 * Resend's webhook payload only lists attachment metadata (name, type, size),
 * the bytes must be pulled from the Resend API. Shared by the webhook route
 * and the admin "Anhänge nachladen" server function.
 */

export type ResendAttachment = {
  id?: string;
  filename?: string;
  name?: string;
  content_type?: string;
  contentType?: string;
  content?: string;
  content_url?: string;
  download_url?: string;
  url?: string;
  size?: number;
};

export type InboundEmailPayload = {
  email_id?: string;
  id?: string;
  message_id?: string;
  from?: unknown;
  to?: unknown;
  subject?: string;
  text?: string;
  html?: string;
  created_at?: string;
  received_at?: string;
  attachments?: ResendAttachment[];
};

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120);
}

export function attachmentName(attachment: ResendAttachment) {
  return attachment.filename ?? attachment.name ?? "anhang";
}

function hasContent(attachment: ResendAttachment) {
  return Boolean(
    attachment.content ?? attachment.content_url ?? attachment.download_url ?? attachment.url,
  );
}

/** True when the payload is missing either the body or actual attachment bytes. */
export function needsResendLookup(data: InboundEmailPayload) {
  const hasBody = Boolean(data.text || data.html);
  const attachments = data.attachments;
  if (!Array.isArray(attachments)) return true;
  if (attachments.some((a) => !hasContent(a))) return true;
  return !hasBody;
}

/** Loads the full inbound mail (body + attachment links) from the Resend API. */
export async function fetchFullEmail(
  emailId: string,
  data: InboundEmailPayload,
): Promise<InboundEmailPayload> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey || !needsResendLookup(data)) return data;

  for (const url of [
    `https://api.resend.com/emails/inbound/${emailId}`,
    `https://api.resend.com/emails/${emailId}`,
  ]) {
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!response.ok) continue;
      const body = (await response.json()) as InboundEmailPayload;
      const merged: InboundEmailPayload = { ...data, ...body };
      if (Array.isArray(body.attachments) && body.attachments.length) {
        merged.attachments = body.attachments;
      }
      if (!needsResendLookup(merged)) return merged;
      // Keep the richer payload but try the next endpoint for the missing parts.
      data = merged;
    } catch (error) {
      console.error(
        `[resend] retrieval failed for ${emailId}:`,
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }
  return data;
}

async function downloadBytes(url: string, apiKey: string | undefined) {
  const isResend = url.startsWith("https://api.resend.com");
  const response = await fetch(url, {
    headers: isResend && apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
  });
  if (!response.ok) throw new Error(`Download fehlgeschlagen (HTTP ${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

/** Resolves the bytes of one attachment, pulling from the Resend API when needed. */
async function attachmentBytes(
  emailId: string,
  attachment: ResendAttachment,
): Promise<Uint8Array> {
  if (attachment.content) return base64ToBytes(attachment.content);

  const apiKey = process.env["RESEND_API_KEY"];
  const direct = attachment.content_url ?? attachment.download_url ?? attachment.url;
  if (direct) return downloadBytes(direct, apiKey);

  if (!apiKey) throw new Error("RESEND_API_KEY fehlt – Anhang kann nicht geholt werden");

  const ref = attachment.id ?? attachmentName(attachment);
  const candidates = [
    `https://api.resend.com/emails/inbound/${emailId}/attachments/${encodeURIComponent(ref)}`,
    `https://api.resend.com/emails/${emailId}/attachments/${encodeURIComponent(ref)}`,
  ];

  let lastError = "kein Inhalt verfügbar";
  for (const url of candidates) {
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        continue;
      }
      const type = response.headers.get("content-type") ?? "";
      if (type.includes("application/json")) {
        const body = (await response.json()) as ResendAttachment;
        if (body.content) return base64ToBytes(body.content);
        const link = body.content_url ?? body.download_url ?? body.url;
        if (link) return downloadBytes(link, apiKey);
        lastError = "Antwort ohne Inhalt";
        continue;
      }
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      lastError = error instanceof Error ? error.message : "unbekannter Fehler";
    }
  }
  throw new Error(lastError);
}

async function storeAttachment(
  supabaseAdmin: AdminClient,
  eventId: string,
  emailRowId: string,
  resendEmailId: string,
  attachment: ResendAttachment,
) {
  const fileName = attachmentName(attachment);
  const mimeType = attachment.content_type ?? attachment.contentType ?? "application/octet-stream";
  const bytes = await attachmentBytes(resendEmailId, attachment);

  const path = `${eventId}/${crypto.randomUUID()}-${safeName(fileName)}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("event-attachments")
    .upload(path, bytes as unknown as ArrayBuffer, { contentType: mimeType, upsert: false });
  if (uploadError) throw uploadError;

  const { error } = await supabaseAdmin.from("event_attachments").insert({
    event_id: eventId,
    event_email_id: emailRowId,
    source: "email",
    file_name: fileName,
    storage_path: path,
    mime_type: mimeType,
    file_size: attachment.size ?? bytes.byteLength,
  });
  if (error) {
    await supabaseAdmin.storage.from("event-attachments").remove([path]);
    throw error;
  }
}

/**
 * Stores every attachment of one mail. Never throws: the result string is
 * written into the delivery log so admins see per-file outcomes.
 */
export async function storeAttachments(
  supabaseAdmin: AdminClient,
  args: {
    eventId: string;
    emailRowId: string;
    resendEmailId: string;
    attachments: ResendAttachment[] | undefined;
  },
): Promise<{ stored: number; failed: number; detail: string | null }> {
  const list = args.attachments ?? [];
  if (!list.length) return { stored: 0, failed: 0, detail: null };

  let stored = 0;
  const problems: string[] = [];
  for (const attachment of list) {
    try {
      await storeAttachment(
        supabaseAdmin,
        args.eventId,
        args.emailRowId,
        args.resendEmailId,
        attachment,
      );
      stored += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unbekannter Fehler";
      problems.push(`${attachmentName(attachment)}: ${message}`);
      console.error(`[resend] attachment failed (${args.resendEmailId}):`, message);
    }
  }

  const detail = problems.length
    ? `${stored}/${list.length} Anhänge gespeichert – ${problems.join("; ")}`
    : `${stored} ${stored === 1 ? "Anhang" : "Anhänge"} gespeichert`;
  return { stored, failed: problems.length, detail };
}
