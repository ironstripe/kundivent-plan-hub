# E-Mail-Adresse sofort bei neuem Eintrag

Heute entsteht das E-Mail-Token erst per Datenbank-Default beim Speichern – deshalb steht die Adresse bei einem neuen Eintrag noch nicht zur Verfügung. Künftig wird das Token schon beim Öffnen des „Neuer Eintrag“-Drawers im Browser erzeugt (zufällig, 10 Zeichen, a–z0–9). Die Adresse und der Zuordnungscode sind damit sofort sichtbar und kopierbar, noch bevor gespeichert wurde.

## Ablauf

1. Nutzer klickt **Neuer Eintrag** → Drawer öffnet sich mit bereits generiertem Token.
2. Abschnitt **Kommunikation** zeigt sofort `event-<token>@rinueeldii.resend.app` + Zuordnungscode, beide mit Kopieren-Button.
3. Beim Speichern wird das Token mitgeschickt und am Eintrag gespeichert – die Adresse ändert sich dadurch nicht.
4. Auch offline erstellte Einträge bekommen ihr Token sofort; es wandert mit durch die Sync-Queue.

## Sicherheit / Kollisionen

- Token wird mit `crypto.getRandomValues` erzeugt; Kollisionen sind praktisch ausgeschlossen.
- Die Datenbank behält ihren Unique-Index und den Default als Sicherheitsnetz: Schlägt ein Insert wegen einer (extrem unwahrscheinlichen) Token-Kollision fehl, wird einmalig mit neuem Token wiederholt.
- Bestehende Einträge behalten ihr Token unverändert.

## Technische Details

- `src/lib/event-email.ts`: neue Funktion `generateInboundToken()` (kryptografisch zufällig, gleiches Alphabet/Länge wie der DB-Default).
- `src/components/kundivent/event-drawer.tsx`: beim Öffnen eines neuen (nicht gespeicherten) Eintrags einmalig Token erzeugen und stabil im State halten; an `CommunicationSection` übergeben statt des bisherigen `null`-Hinweises.
- `src/lib/events.ts`: `EventInput` um optionales `inbound_email_token` erweitern; Insert sendet das Token mit, Update ignoriert es. Bei Unique-Verletzung auf dem Token: neues Token ziehen und Insert einmal wiederholen.
- `src/lib/offline-queue.ts` / `offline-db.ts`: Token beim Offline-Anlegen mitspeichern und beim Sync durchreichen, damit auch Offline-Einträge ihre Adresse behalten.
- Keine Migration nötig: Spalte, Default und Unique-Index existieren bereits.
