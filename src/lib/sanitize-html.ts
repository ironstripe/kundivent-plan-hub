/**
 * Minimal HTML sanitiser for archived e-mail bodies.
 *
 * The result is additionally rendered inside a sandboxed iframe, so this is a
 * defence-in-depth step: remove anything executable before it ever reaches the DOM.
 */
export function sanitizeEmailHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form)\b[^>]*\/?>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
    .replace(/(href|src|action)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"')
    .replace(/(href|src|action)\s*=\s*("|')\s*data:text\/html[^"']*\2/gi, '$1="#"');
}
