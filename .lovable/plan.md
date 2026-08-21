# Ersteller und Erstelldatum je Eintrag

Zusätzlich zum bestehenden Feld „Verantwortlich" (wer den Event durchführt) wird festgehalten, **wer** einen Eintrag angelegt hat und **wann**.

## Datenmodell
- Neue Spalte `created_by` in `events`: Verweis auf ein Benutzerprofil, leer erlaubt, bleibt beim Löschen eines Benutzers erhalten (auf leer gesetzt).
- Das Erstelldatum ist bereits vorhanden (`created_at`) und wird nur noch angezeigt.
- Beim Speichern eines neuen Eintrags wird automatisch der angemeldete Benutzer als Ersteller gesetzt. Das Feld ist nicht editierbar und ändert sich beim Bearbeiten nicht.
- Bestehende Einträge (inkl. Excel-Migration) bleiben ohne Ersteller und werden als „—" bzw. „Import" dargestellt.

## Anzeige
- **Eintrags-Drawer:** unterhalb des Formulars eine dezente Metazeile beim Bearbeiten: „Erstellt von {Name} am {TT.MM.JJJJ, HH:MM}". Bei neuen Einträgen ausgeblendet.
- **Einträge-Tabelle:** neue, schmale Spalte „Erstellt" mit Datum; Ersteller-Name als Tooltip bzw. zweite Zeile. Optional zusätzlich sortierbar nach Erstelldatum.
- **Kalender-Hover-Vorschau:** Zeile „Erstellt von …" unter „Verantwortlich".
- Inaktive Benutzer werden wie bisher als „Name · Inaktiv" formatiert.

## Filter
- Der bestehende Filterbereich in „Einträge" erhält ein zusätzliches Dropdown „Erstellt von" (Alle / einzelne Benutzer / Ohne Angabe).

## Technische Details
- Migration: `ALTER TABLE public.events ADD COLUMN created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;` plus Index auf `created_by`.
- `src/lib/events.ts`: `created_by` in `EventInput`/Mapping; beim Insert aus `supabase.auth.getUser()` gesetzt, beim Update nicht überschrieben.
- UI-Anpassungen in `event-drawer.tsx`, `eintraege.tsx`, `month-calendar.tsx`; Namensauflösung über das bestehende `useProfiles` / `profileLabel`.
