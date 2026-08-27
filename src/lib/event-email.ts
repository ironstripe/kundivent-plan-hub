/**
 * Inbound event e-mail addresses.
 *
 * Every event owns a stable random token; the address is derived from it.
 * Domain and (optional) fixed mailbox live in configuration so components
 * never hardcode them.
 */

export const DEFAULT_INBOUND_DOMAIN = "rinueeldii.resend.app";

function env(name: string): string | undefined {
  const value =
    typeof import.meta !== "undefined"
      ? (import.meta.env?.[name] as string | undefined)
      : undefined;
  return value && value.trim() ? value.trim() : undefined;
}

export const INBOUND_EMAIL_DOMAIN = env("VITE_RESEND_INBOUND_DOMAIN") ?? DEFAULT_INBOUND_DOMAIN;

/**
 * Optional fixed mailbox for plus addressing. Disabled by default: the Resend
 * sandbox mailbox does not deliver plus-addressed mail, only `event-<token>@`.
 */
export const INBOUND_EMAIL_MAILBOX = env("VITE_RESEND_INBOUND_MAILBOX");

export function eventEmailAddress(
  token: string,
  domain: string = INBOUND_EMAIL_DOMAIN,
  mailbox: string | undefined = INBOUND_EMAIL_MAILBOX,
) {
  return mailbox ? `${mailbox}+${token}@${domain}` : `event-${token}@${domain}`;
}

const TOKEN_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const TOKEN_LENGTH = 10;

/**
 * Generates a random inbound token in the browser (same alphabet/length as
 * the database default), so a new entry shows its address before saving.
 */
export function generateInboundToken(): string {
  const bytes = new Uint8Array(TOKEN_LENGTH);
  crypto.getRandomValues(bytes);
  let token = "";
  for (const byte of bytes) token += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length];
  return token;
}

/** Code the user can put into the subject when plus addressing is not possible. */
export function eventEmailCode(token: string) {
  return `#${token}`;
}

const TOKEN = "[a-z0-9]{6,32}";

/**
 * Extracts the event token from a recipient address.
 * Accepts `event-<token>@`, `<mailbox>+<token>@` and plain `<token>@`.
 */
export function parseInboundToken(address: string | null | undefined): string | null {
  if (!address) return null;
  // Tolerates "Name <event-abc@domain>" and plain addresses.
  const bare = address.includes("<") ? (address.split("<").pop() ?? "").replace(">", "") : address;
  const local = bare.trim().toLowerCase().split("@")[0];
  if (!local) return null;

  const prefixed = local.match(new RegExp(`^event-(${TOKEN})$`));
  if (prefixed) return prefixed[1]!;

  const plus = local.match(new RegExp(`\\+(?:event-)?(${TOKEN})$`));
  if (plus) return plus[1]!;

  if (local === INBOUND_EMAIL_MAILBOX) return null;

  const plain = local.match(new RegExp(`^(${TOKEN})$`));
  if (plain) return plain[1]!;


  return null;
}

/** Fallback: finds `#<token>` in a subject or message body. */
export function inboundTokenFromText(...parts: (string | null | undefined)[]): string | null {
  for (const part of parts) {
    if (!part) continue;
    const match = part.toLowerCase().slice(0, 2000).match(new RegExp(`#(${TOKEN})\\b`));
    if (match) return match[1]!;
  }
  return null;
}

export function formatEmailDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
