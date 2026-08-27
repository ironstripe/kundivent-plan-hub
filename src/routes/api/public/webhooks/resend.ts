import { createFileRoute } from "@tanstack/react-router";
import { inboundTokenFromText, parseInboundToken } from "@/lib/event-email";
import {
  fetchFullEmail,
  storeAttachments,
  type InboundEmailPayload,
} from "@/lib/inbound-attachments.server";


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

type InboundEmail = InboundEmailPayload & {
  from?: ResendAddress;
  to?: ResendAddress[] | ResendAddress;
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

        let payload: { type?: string; data?: InboundEmail };
        try {
          payload = JSON.parse(rawBody) as { type?: string; data?: InboundEmail };
        } catch {
          console.warn("[resend-webhook] unparseable payload");
          return ok("ignored");
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

        const full = (await fetchFullEmail(resendEmailId, data)) as InboundEmail;
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
        const result = await storeAttachments(supabaseAdmin, {
          eventId: event.id,
          emailRowId: inserted.id,
          resendEmailId,
          attachments: full.attachments,
        });

        await logDelivery(supabaseAdmin, {
          ...base,
          outcome: "stored",
          event_id: event.id,
          detail: result.detail,
        });

        return ok("stored");
      },
    },
  },
});

