# Build 10: Zentrale Benutzerverwaltung

Benutzer werden künftig ausschliesslich durch Administratoren angelegt und verwaltet — kein Self-Service, keine Einladungen, keine Rollen ausser Admin / Nicht-Admin.

## Datenbank

Neue Tabelle `profiles` (1:1 zu den Auth-Benutzern):
- `display_name`, `active` (Standard: ja), `is_admin` (Standard: nein), `must_change_password` (Standard: ja), Zeitstempel
- Trigger, der bei jedem neuen Auth-Benutzer automatisch ein Profil erstellt
- Bestehende Benutzer werden übernommen: aktiv, kein erzwungener Passwortwechsel; `test@kundivent.ch` wird als erster Administrator gesetzt
- Zugriffsregeln: alle angemeldeten Benutzer dürfen die Liste lesen; Änderungen an Status, Admin-Flag, Passwort-Flag oder E-Mail laufen ausschliesslich über geschützte Server-Aktionen — niemand kann sich selbst zum Admin machen
- Es werden keine Passwörter, Hashes oder Tokens in Kundivent gespeichert

## Server-Aktionen (geschützt, admin-geprüft)

Eine Server-Datei mit Aktionen, die jeweils zuerst prüfen, ob der aufrufende Benutzer Admin und aktiv ist:
- Benutzer anlegen (Auth-Benutzer + Profil, E-Mail bereits bestätigt, `must_change_password = true`, kein Einladungsmail)
- Benutzer bearbeiten (Name, E-Mail inkl. Auth-Update, Aktiv, Admin)
- Passwort administrativ zurücksetzen (neues Passwort in Auth setzen, `must_change_password = true`)
- Benutzer deaktivieren / endgültig löschen (nur mit ausdrücklicher Bestätigung; Eventdaten bleiben unberührt)
- Benutzerliste inkl. E-Mail aus Auth laden
- Schutzregel: der letzte aktive Administrator kann nicht deaktiviert, herabgestuft oder gelöscht werden — klare Fehlermeldung
- Eigenes Passwort setzen (für den erzwungenen Wechsel), danach `must_change_password = false`

## Anmeldung & erzwungener Passwortwechsel

- Login-Seite wird minimal: nur E-Mail, Passwort, „Anmelden“. „Neues Konto erstellen“ wird entfernt, kein „Passwort vergessen“.
- Der geschützte Bereich lädt beim Eintritt das eigene Profil:
  - inaktiv → Abmelden mit Meldung „Dieser Benutzer ist deaktiviert.“
  - `must_change_password = true` → Vollbild-Dialog „Passwort ändern“ (Neues Passwort / Passwort bestätigen, min. 8 Zeichen, muss übereinstimmen, Inline-Fehler). Die App ist bis zum Erfolg nicht bedienbar; danach direkt weiter in die Übersicht.
- Session-Verhalten bleibt unverändert.

## Einstellungen → Benutzer

- In Einstellungen ein neuer Abschnitt „Benutzer“, nur für Admins sichtbar (Planungsbereiche und Kategorien bleiben unverändert)
- Kompakte Tabelle: Name, E-Mail, Status, Admin, Passwortstatus, Aktionen (Bearbeiten, Passwort zurücksetzen, Deaktivieren/Aktivieren, Löschen)
- Button „+ Benutzer“ öffnet ein kompaktes Drawer mit Name, E-Mail, Initiales Passwort, Aktiv, Admin
- Nach dem Anlegen wird das Passwort nicht mehr angezeigt; der Admin gibt es separat weiter
- Bestehende Optik: gleiche Tabellen, Drawer, Badges und Buttons wie im übrigen Kundivent

## Technische Details

- `profiles` mit GRANTs, RLS und Security-Definer-Funktion `is_active_admin(uuid)` für Policies und Server-Prüfungen
- Server-Logik als `createServerFn` mit `requireSupabaseAuth`; privilegierte Aufrufe laden den Admin-Client erst im Handler
- Neue Dateien: `src/lib/users.functions.ts`, `src/lib/users.ts` (Query-Hooks), `src/components/kundivent/user-drawer.tsx`, `src/components/kundivent/force-password-change.tsx`
- Angepasst: `src/routes/auth.tsx`, `src/routes/_authenticated/route.tsx`, `src/routes/_authenticated/einstellungen.tsx`
- Abschliessend Test des kompletten Ablaufs (Anlegen → erzwungener Wechsel → erneuter Login → Admin-Reset → Deaktivierung) im Browser
