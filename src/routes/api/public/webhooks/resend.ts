import { createFileRoute } from "@tanstack/react-router";
import { inboundTokenFromText, parseInboundToken } from "@/lib/event-email";


/**
 * Resend inbound webhook.
 *
 * Receives `email.received` events, maps the recipient address to a Kundivent
 * event and archives the mail plus its attachments. The endpoint is public by
 * necessity, so every request must pass Svix signature verification first.
 */

type SvixHeaders = { id: string; timestamp: string; signature: string };

function readSvixHeaders(request: Request): SvixHeaders | null {
  const id = request.headers.get("svix-id") ?? request.headers.get("webhook-id");
  const timestamp =
    request.headers.get("svix-timestamp") ?? request.headers.get("webhook-timestamp");
  const signature =
    request.headers.get("svix-signature") ?? request.headers.get("webhook-signature");
  if (!id || !timestamp || !signature) return null;
  return { id, timestamp, signature };
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Svix scheme: HMAC-SHA256 over `${id}.${timestamp}.${rawBody}` with the base64 secret. */
async function verifySignature(
  secret: string,
  headers: SvixHeaders,
  rawBody: string,
): Promise<boolean> {
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(headers.timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 60 * 5) return false;

  const secretBytes = base64ToBytes(secret.replace(/^whsec_/, ""));
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = new TextEncoder().encode(`${headers.id}.${headers.timestamp}.${rawBody}`);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, signed));
  const expected = bytesToBase64(digest);

  return headers.signature
    .split(" ")
    .map((part) => (part.includes(",") ? part.split(",")[1]! : part))
    .some((candidate) => timingSafeEqual(candidate, expected));
}

type ResendAddress = string | { address?: string; email?: string; name?: string };

type ResendAttachment = {
  filename?: string;
  name?: string;
  content_type?: string;
  contentType?: string;
  content?: string;
  content_url?: string;
  url?: string;
  size?: number;
};

type InboundEmail = {
  email_id?: string;
  id?: string;
  message_id?: string;
  from?: ResendAddress;
  to?: ResendAddress[] | ResendAddress;
  subject?: string;
  text?: string;
  html?: string;
  created_at?: string;
  received_at?: string;
  attachments?: ResendAttachment[];
};

function addressOf(value: ResendAddress | undefined): { address: string; name: string | null } {
  if (!value) return { address: "", name: null };
  if (typeof value === "string") {
    const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
    if (match) return { address: match[2]!.toLowerCase(), name: match[1] || null };
    return { address: value.trim().toLowerCase(), name: null };
  }
  const address = (value.address ?? value.email ?? "").toLowerCase();
  return { address, name: value.name ?? null };
}

function recipientList(value: InboundEmail["to"]): ResendAddress[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120);
}

const ok = (message: string) => new Response(JSON.stringify({ ok: true, message }), {
  status: 200,
  headers: { "content-type": "application/json" },
});

type AdminClientType = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

/** Every delivery is written to the log, so admins see what arrived and why it matched or not. */
async function logDelivery(
  supabaseAdmin: AdminClientType,
  entry: {
    resend_email_id?: string | null;
    recipients?: string | null;
    from_address?: string | null;
    subject?: string | null;
    outcome: string;
    detail?: string | null;
    event_id?: string | null;
  },
) {
  const { error } = await supabaseAdmin.from("inbound_email_log").insert({
    resend_email_id: entry.resend_email_id ?? null,
    recipients: entry.recipients ?? null,
    from_address: entry.from_address ?? null,
    subject: entry.subject ?? null,
    outcome: entry.outcome,
    detail: entry.detail ?? null,
    event_id: entry.event_id ?? null,
  });
  if (error) console.error("[resend-webhook] log insert failed", error.message);
}

export const Route = createFileRoute("/api/public/webhooks/resend")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RESEND_WEBHOOK_SECRET"];
        if (!secret) {
          console.error("[resend-webhook] RESEND_WEBHOOK_SECRET is not configured");
          return new Response("Not configured", { status: 500 });
        }

        const rawBody = await request.text();
        const headers = readSvixHeaders(request);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (headers && !(await verifySignature(secret, headers, rawBody))) {
          console.warn("[resend-webhook] rejected request with invalid signature");
          // Signaturfehler ins Protokoll, damit "Resend ruft auf, aber Secret falsch"
          // von "Resend ruft gar nicht auf" unterscheidbar bleibt.
          await logDelivery(supabaseAdmin, {
            outcome: "invalid_signature",
            detail: "Signatur ungültig – prüfe, ob RESEND_WEBHOOK_SECRET zum aktuellen Resend-Webhook passt",
          });
          return new Response("Invalid signature", { status: 401 });
        }
        if (!headers) {
          console.warn("[resend-webhook] rejected request without signature headers");
          return new Response("Invalid signature", { status: 401 });
        }


        if (payload.type !== "email.received") {
          await logDelivery(supabaseAdmin, {
            outcome: "ignored",
            detail: `Ereignis ${payload.type ?? "unbekannt"}`,
          });
          return ok("ignored");
        }

        const data = payload.data ?? {};
        const resendEmailId = data.email_id ?? data.id;
        const recipients = recipientList(data.to).map((entry) => addressOf(entry).address);
        const recipientText = recipients.join(", ");
        const fromPreview = addressOf(data.from).address || null;
        const base = {
          resend_email_id: resendEmailId ?? null,
          recipients: recipientText || null,
          from_address: fromPreview,
          subject: data.subject ?? null,
        };

        if (!resendEmailId) {
          await logDelivery(supabaseAdmin, { ...base, outcome: "error", detail: "Keine E-Mail-ID" });
          return ok("ignored");
        }

        const matched = recipients
          .map((address) => ({ address, token: parseInboundToken(address) }))
          .find((entry) => entry.token);

        // Fallback for fixed inbound mailboxes: allow "#token" in subject or body.
        const token =
          matched?.token ?? inboundTokenFromText(data.subject, data.text, data.html);
        const toAddress = matched?.address ?? recipients[0] ?? "unbekannt";

        if (!token) {
          console.warn(`[resend-webhook] no event token for email ${resendEmailId}`);
          await logDelivery(supabaseAdmin, {
            ...base,
            outcome: "no_token",
            detail: "Kein Eintrags-Token in Adresse, Betreff oder Text gefunden",
          });
          return ok("no matching event");
        }

        // Idempotency: a retried delivery must not create a second record.
        const { data: existing, error: existingError } = await supabaseAdmin
          .from("event_emails")
          .select("id")
          .eq("resend_email_id", resendEmailId)
          .maybeSingle();
        if (existingError) {
          console.error("[resend-webhook] lookup failed", existingError.message);
          await logDelivery(supabaseAdmin, {
            ...base,
            outcome: "error",
            detail: existingError.message,
          });
          return new Response("Lookup failed", { status: 500 });
        }
        if (existing) {
          await logDelivery(supabaseAdmin, { ...base, outcome: "duplicate" });
          return ok("duplicate");
        }

        const { data: event, error: eventError } = await supabaseAdmin
          .from("events")
          .select("id")
          .eq("inbound_email_token", token)
          .maybeSingle();
        if (eventError) {
          console.error("[resend-webhook] event lookup failed", eventError.message);
          await logDelivery(supabaseAdmin, {
            ...base,
            outcome: "error",
            detail: eventError.message,
          });
          return new Response("Lookup failed", { status: 500 });
        }
        if (!event) {
          await logDelivery(supabaseAdmin, {
            ...base,
            outcome: "unknown_token",
            detail: `Token ${token} gehört zu keinem Eintrag`,
          });
          return ok("unknown event token");
        }

        const full = await fetchFullEmail(resendEmailId, data);
        const from = addressOf(full.from);

        const { data: inserted, error: insertError } = await supabaseAdmin
          .from("event_emails")
          .insert({
            event_id: event.id,
            resend_email_id: resendEmailId,
            message_id: full.message_id ?? null,
            from_address: from.address || "unbekannt",
            from_name: from.name,
            to_address: toAddress,
            subject: full.subject ?? null,
            text_body: full.text ?? null,
            html_body: full.html ?? null,
            received_at: full.received_at ?? full.created_at ?? new Date().toISOString(),
          })
          .select("id")
          .single();
        if (insertError || !inserted) {
          console.error("[resend-webhook] insert failed", insertError?.message);
          await logDelivery(supabaseAdmin, {
            ...base,
            outcome: "error",
            detail: insertError?.message ?? "Speichern fehlgeschlagen",
            event_id: event.id,
          });
          return new Response("Insert failed", { status: 500 });
        }

        // Attachments are best effort: a failure must never discard the mail.
        let attachmentError: string | null = null;
        for (const attachment of full.attachments ?? []) {
          try {
            await storeAttachment(supabaseAdmin, event.id, inserted.id, attachment);
          } catch (error) {
            attachmentError = error instanceof Error ? error.message : "unknown error";
            console.error(
              `[resend-webhook] attachment failed for email ${resendEmailId}:`,
              attachmentError,
            );
          }
        }

        await logDelivery(supabaseAdmin, {
          ...base,
          outcome: "stored",
          event_id: event.id,
          detail: attachmentError ? `Anhang-Fehler: ${attachmentError}` : null,
        });

        return ok("stored");
      },
    },
  },
});


/** Falls back to the Resend API when the webhook payload carries no body/attachments. */
async function fetchFullEmail(emailId: string, data: InboundEmail): Promise<InboundEmail> {
  const hasBody = Boolean(data.text || data.html);
  const hasAttachments = Array.isArray(data.attachments);
  if (hasBody && hasAttachments) return data;

  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) return data;

  for (const url of [
    `https://api.resend.com/emails/inbound/${emailId}`,
    `https://api.resend.com/emails/${emailId}`,
  ]) {
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (!response.ok) continue;
      const body = (await response.json()) as InboundEmail;
      return { ...data, ...body };
    } catch (error) {
      console.error(
        `[resend-webhook] retrieval failed for ${emailId}:`,
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }
  return data;
}

type AdminClient = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

async function storeAttachment(
  supabaseAdmin: AdminClient,
  eventId: string,
  emailId: string,
  attachment: ResendAttachment,
) {
  const fileName = attachment.filename ?? attachment.name ?? "anhang";
  const mimeType = attachment.content_type ?? attachment.contentType ?? "application/octet-stream";

  let bytes: Uint8Array | null = null;
  if (attachment.content) {
    bytes = base64ToBytes(attachment.content);
  } else {
    const url = attachment.content_url ?? attachment.url;
    if (!url) throw new Error(`attachment ${fileName} has no content`);
    const apiKey = process.env["RESEND_API_KEY"];
    const response = await fetch(url, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!response.ok) throw new Error(`download failed with status ${response.status}`);
    bytes = new Uint8Array(await response.arrayBuffer());
  }

  const path = `${eventId}/${crypto.randomUUID()}-${safeName(fileName)}`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("event-attachments")
    .upload(path, bytes as unknown as ArrayBuffer, { contentType: mimeType, upsert: false });
  if (uploadError) throw uploadError;

  const { error } = await supabaseAdmin.from("event_attachments").insert({
    event_id: eventId,
    event_email_id: emailId,
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
