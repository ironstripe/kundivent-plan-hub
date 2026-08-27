/**
 * Inbound event e-mail addresses.
 *
 * Every event owns a stable random token; the address is derived from it.
 * The domain lives in configuration so components never hardcode it.
 */

export const DEFAULT_INBOUND_DOMAIN = "rinueeldii.resend.app";

export const INBOUND_EMAIL_DOMAIN =
  (typeof import.meta !== "undefined"
    ? (import.meta.env?.["VITE_RESEND_INBOUND_DOMAIN"] as string | undefined)
    : undefined) || DEFAULT_INBOUND_DOMAIN;

export function eventEmailAddress(token: string, domain: string = INBOUND_EMAIL_DOMAIN) {
  return `event-${token}@${domain}`;
}

/** Extracts the event token from a recipient address, or null when it does not match. */
export function parseInboundToken(address: string | null | undefined): string | null {
  if (!address) return null;
  // Tolerates "Name <event-abc@domain>" and plain addresses.
  const bare = address.includes("<") ? (address.split("<").pop() ?? "").replace(">", "") : address;
  const match = bare.trim().toLowerCase().match(/^event-([a-z0-9]{6,32})@/);
  return match ? match[1]! : null;
}

export function formatEmailDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
