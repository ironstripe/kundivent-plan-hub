/**
 * Server-side receiver for the KundiCalc → Kundivent handover (contract v1).
 *
 * Security model:
 *  - a shared integration credential authenticates the *calling application*
 *  - an explicit admin-maintained mapping resolves the *source user* to an
 *    existing Kundivent profile; no auto-creation, no e-mail matching
 *  - Kundivent permissions (active + editor/admin) are enforced for writes
 *  - missing configuration fails closed (503)
 *
 * All privileged database access happens through the service-role client only
 * after those checks; the transactional write itself runs inside the
 * `kundicalc_handover` database procedure (not publicly executable).
 */
import { z } from "zod";

export const CONTRACT_VERSION = "v1";

const MAX_BODY_BYTES = 16 * 1024;

export type ErrorCode =
  | "integration_not_configured"
  | "invalid_credentials"
  | "unmapped_source_user"
  | "inactive_user"
  | "insufficient_permissions"
  | "invalid_payload"
  | "invalid_category"
  | "invalid_planning_area"
  | "invalid_responsible_user"
  | "target_not_found"
  | "target_changed"
  | "cancelled_target"
  | "association_conflict"
  | "idempotency_conflict"
  | "transaction_failed"
  | "not_found";

const MESSAGES: Record<ErrorCode, string> = {
  integration_not_configured: "Die KundiCalc-Schnittstelle ist nicht konfiguriert.",
  invalid_credentials: "Ungültige Zugangsdaten für die Schnittstelle.",
  unmapped_source_user: "Für diesen KundiCalc-Benutzer besteht keine Zuordnung in Kundivent.",
  inactive_user: "Der zugeordnete Kundivent-Benutzer ist deaktiviert.",
  insufficient_permissions: "Der zugeordnete Benutzer hat keine Bearbeitungsrechte.",
  invalid_payload: "Die Anfrage ist unvollständig oder ungültig.",
  invalid_category: "Die Kategorie existiert nicht oder ist inaktiv.",
  invalid_planning_area: "Mindestens ein Planungsbereich fehlt oder ist inaktiv.",
  invalid_responsible_user: "Die verantwortliche Person ist ungültig oder deaktiviert.",
  target_not_found: "Der Ziel-Eintrag wurde nicht gefunden.",
  target_changed: "Der Ziel-Eintrag wurde zwischenzeitlich geändert. Bitte erneut prüfen.",
  cancelled_target: "Abgesagte Einträge können nicht bestätigt werden.",
  association_conflict: "Für diese Verknüpfung besteht bereits eine Zuordnung.",
  idempotency_conflict: "Derselbe Idempotenzschlüssel wurde mit anderem Inhalt verwendet.",
  transaction_failed: "Die Übergabe konnte nicht abgeschlossen werden.",
  not_found: "Nicht gefunden.",
};

const STATUS: Record<ErrorCode, number> = {
  integration_not_configured: 503,
  invalid_credentials: 401,
  unmapped_source_user: 403,
  inactive_user: 403,
  insufficient_permissions: 403,
  invalid_payload: 400,
  invalid_category: 422,
  invalid_planning_area: 422,
  invalid_responsible_user: 422,
  target_not_found: 404,
  target_changed: 409,
  cancelled_target: 409,
  association_conflict: 409,
  idempotency_conflict: 409,
  transaction_failed: 500,
  not_found: 404,
};

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && value in MESSAGES;
}

export function fail(code: ErrorCode, detail?: string): Response {
  return Response.json(
    {
      error: {
        code,
        message: MESSAGES[code],
        ...(detail ? { detail } : {}),
      },
      contract_version: CONTRACT_VERSION,
    },
    { status: STATUS[code] },
  );
}

export type IntegrationConfig = {
  apiKey: string;
  sourceSystem: string;
  /** Trusted base URL used to build calculation deep links. */
  calculationBaseUrl: string | null;
  /** Optional override for the Kundivent deep link base. */
  appBaseUrl: string | null;
};

export function readConfig(): IntegrationConfig | null {
  const apiKey = process.env["KUNDICALC_INTEGRATION_KEY"];
  if (!apiKey || apiKey.length < 24) return null;
  return {
    apiKey,
    sourceSystem: process.env["KUNDICALC_SOURCE_SYSTEM"] || "kundicalc",
    calculationBaseUrl: process.env["KUNDICALC_BASE_URL"] || null,
    appBaseUrl: process.env["KUNDIVENT_BASE_URL"] || null,
  };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type Actor = {
  sourceActorId: string;
  profileId: string;
  role: "viewer" | "editor" | "admin";
  active: boolean;
};

export type AuthOk = { config: IntegrationConfig; actor: Actor };

/**
 * Authenticates the calling application and resolves the mapped Kundivent user.
 * Returns a ready-to-send error `Response` on any failure (fails closed).
 */
export async function authenticate(request: Request): Promise<AuthOk | Response> {
  const config = readConfig();
  if (!config) return fail("integration_not_configured");

  const presented = request.headers.get("x-kundicalc-key") ?? "";
  if (!presented || !timingSafeEqual(presented, config.apiKey)) {
    return fail("invalid_credentials");
  }

  const sourceActorId = (request.headers.get("x-kundicalc-actor") ?? "").trim();
  if (!sourceActorId || sourceActorId.length > 128) return fail("unmapped_source_user");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: mapping, error } = await supabaseAdmin
    .from("integration_user_map")
    .select("profile_id, active")
    .eq("source_system", config.sourceSystem)
    .eq("source_actor_id", sourceActorId)
    .maybeSingle();
  if (error) return fail("transaction_failed");
  if (!mapping || !mapping.active) return fail("unmapped_source_user");

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id, role, active")
    .eq("id", mapping.profile_id)
    .maybeSingle();
  if (profileError) return fail("transaction_failed");
  if (!profile) return fail("unmapped_source_user");
  if (!profile.active) return fail("inactive_user");

  return {
    config,
    actor: {
      sourceActorId,
      profileId: profile.id,
      role: profile.role as Actor["role"],
      active: profile.active,
    },
  };
}

export function requireWriteAccess(actor: Actor): Response | null {
  if (actor.role !== "editor" && actor.role !== "admin") return fail("insufficient_permissions");
  return null;
}

export async function readJsonBody(request: Request): Promise<unknown | Response> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return fail("invalid_payload", "payload_too_large");
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return fail("invalid_payload", "invalid_json");
  }
}

/** Stable SHA-256 fingerprint over the canonical (key-sorted) payload. */
export async function fingerprint(value: unknown): Promise<string> {
  const canonical = JSON.stringify(sortValue(value));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortValue(v)]),
    );
  }
  return value;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date");
const isoTime = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "time");
const uuid = z.string().uuid();
const shortId = z.string().min(1).max(128);

const baseSchema = {
  contract_version: z.literal(CONTRACT_VERSION),
  source_system: shortId,
  source_event_id: shortId,
  source_calculation_id: shortId.optional(),
  source_actor_id: shortId,
  execution_approval_ref: z.string().min(1).max(200),
  execution_approved_at: z.string().datetime({ offset: true }),
  idempotency_key: z.string().min(8).max(128),
};

export const createSchema = z.object({
  ...baseSchema,
  operation: z.literal("create"),
  event: z.object({
    title: z.string().trim().min(2).max(200),
    category_id: uuid,
    planning_area_ids: z.array(uuid).min(1).max(20),
    start_date: isoDate,
    end_date: isoDate.optional(),
    all_day: z.boolean(),
    start_time: isoTime.optional(),
    end_time: isoTime.optional(),
    pax: z.number().int().min(1).max(100000).optional(),
    notes: z.string().max(2000).optional(),
    responsible_user_id: uuid.optional(),
  }),
});

export const linkSchema = z.object({
  ...baseSchema,
  operation: z.literal("link"),
  target_event_id: uuid,
  /** Explicit human confirmation of the status change in KundiCalc. */
  confirm_status_change: z.literal(true),
  expected_updated_at: z.string().datetime({ offset: true }),
});

export const handoverSchema = z.discriminatedUnion("operation", [createSchema, linkSchema]);

export type HandoverRequest = z.infer<typeof handoverSchema>;

/** Additional business validation that Zod cannot express. */
export function validateCreateFields(event: z.infer<typeof createSchema>["event"]): ErrorCode | null {
  if (event.end_date && event.end_date < event.start_date) return "invalid_payload";
  if (!event.all_day) {
    if (!event.start_time || !event.end_time) return "invalid_payload";
    if (event.end_time <= event.start_time) return "invalid_payload";
  }
  return null;
}

/** Calculation deep link, built from the trusted base URL only. */
export function calculationUrl(config: IntegrationConfig, calculationId: string | undefined) {
  if (!config.calculationBaseUrl || !calculationId) return null;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(calculationId)) return null;
  const base = config.calculationBaseUrl.replace(/\/+$/, "");
  return `${base}/kalkulation/${encodeURIComponent(calculationId)}`;
}

/** Kundivent deep link that opens the event after authentication. */
export function targetUrl(config: IntegrationConfig, request: Request, eventId: string) {
  const base = (config.appBaseUrl || new URL(request.url).origin).replace(/\/+$/, "");
  return `${base}/?event=${eventId}`;
}
