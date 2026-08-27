# Inbound-E-Mail-Zuordnung reparieren

## Befund

- Der Webhook läuft: ein Testaufruf auf `/api/public/webhooks/resend` antwortet korrekt mit „Invalid signature“ (401). Die Route ist also veröffentlicht und erreichbar.
- In der Datenbank liegen bislang **0** eingegangene E-Mails.
- Die benutzte Adresse `583549e157@rinueeldii.resend.app` ist die feste Resend-Sandbox-Adresse. Sie enthält kein Eintrags-Token, deshalb kann die Mail keinem Eintrag zugeordnet werden – die aktuelle Logik erwartet `event-<token>@…`.

Ob Resend überhaupt zugestellt hat, lässt sich heute nicht prüfen, weil nicht zugeordnete Zustellungen nur ins Log gehen und nirgends sichtbar sind.

## Was gebaut wird

### 1. Flexible Zuordnung der Empfängeradresse

Der Webhook akzeptiert künftig mehrere Adressformen und ordnet über das Eintrags-Token zu:

- `event-<token>@domain` (bisher)
- `<mailbox>+<token>@domain` – Plus-Adressierung auf der Sandbox-Adresse
- `<token>@domain` – falls die Domain als Catch-all läuft

Zusätzlich als Rückfall: enthält keine Empfängeradresse ein Token, wird im Betreff und in den ersten Zeilen des Textes nach `#<token>` gesucht. So funktioniert die Weiterleitung auch an die feste Sandbox-Adresse, wenn Plus-Adressierung nicht durchkommt.

### 2. Anzeige im Eintrag anpassen

Die im Drawer angezeigte Adresse richtet sich nach der Konfiguration:

- Ist eine feste Sandbox-Mailbox konfiguriert (z. B. `583549e157`), zeigt der Eintrag `583549e157+<token>@rinueeldii.resend.app`.
- Sonst weiterhin `event-<token>@<domain>`.

Ergänzend wird unter der Adresse der Zuordnungscode `#<token>` mit eigenem Kopieren-Button angezeigt, den man im Betreff mitschicken kann.

### 3. Sichtbares Zustellprotokoll

Neue Tabelle `inbound_email_log` mit Zeitpunkt, Empfängeradressen, Betreff, Resend-ID und Ergebnis (`stored`, `duplicate`, `no_token`, `unknown_token`, `error`). Der Webhook schreibt dort jede verarbeitete Zustellung hinein – auch die nicht zugeordneten.

Unter **Einstellungen** sehen Admins die letzten Einträge dieses Protokolls. Damit ist sofort erkennbar, ob Resend zugestellt hat und woran die Zuordnung scheiterte.

## Technische Details

- `src/lib/event-email.ts`: `parseInboundToken` erweitern (Präfix-, Plus- und Nur-Token-Form), neue `inboundTokenFromText()` für den Betreff-Rückfall, `eventEmailAddress()` liest optional `VITE_RESEND_INBOUND_MAILBOX`.
- `src/routes/api/public/webhooks/resend.ts`: Signaturprüfung unverändert; danach Token-Auflösung über die neuen Helfer, Protokollzeile in `inbound_email_log` in allen Ausgängen.
- Migration: `inbound_email_log` anlegen inkl. GRANTs, RLS (SELECT nur für aktive Admins, Schreiben nur serverseitig).
- Neue Admin-Komponente für die Protokollanzeige, eingebunden in `src/routes/_authenticated/einstellungen.tsx`.
- Der Webhook in Resend zeigt bereits auf `https://kundivent-plan-hub.lovable.app/api/public/webhooks/resend`; nach der Umsetzung ist ein erneutes Veröffentlichen nötig, damit die Änderungen live sind.
