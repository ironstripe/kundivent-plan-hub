# Planungsbereiche verwalten (nur Admins)

Ziel: Admins können unter „Einstellungen → Planungsbereiche“ Bereiche anlegen, bearbeiten, aktivieren/deaktivieren und – wenn unbenutzt – löschen. Für normale Benutzer bleibt die Liste unverändert nur lesbar.

## Was der Nutzer sieht

- In der Sektion „Planungsbereiche“ erscheint für Admins ein Button „Bereich hinzufügen“ sowie pro Zeile Aktionen „Bearbeiten“ und „Löschen“.
- Dialog mit den Feldern: Name (Pflicht, eindeutig), Reihenfolge (Nr.) und Schalter „Aktiv“.
- Deaktivierte Bereiche bleiben in bestehenden Einträgen sichtbar, stehen aber bei neuen Einträgen nicht mehr zur Auswahl (heutiges Verhalten bleibt).
- Löschen ist nur möglich, wenn der Bereich in keinem Eintrag verwendet wird. Sonst erscheint ein Hinweis: „Dieser Bereich wird in X Einträgen verwendet und kann nicht gelöscht werden. Er kann stattdessen deaktiviert werden.“ mit Direkt-Aktion „Deaktivieren“.
- Sortierung der Liste weiterhin nach Nr.; nach dem Speichern aktualisieren sich Kalender, Matrix und Filter automatisch.
- Farbe: Bereichsfarben stammen aus dem bestehenden Farbsystem, das anhand des Namens zuordnet. Neue Bereiche mit unbekanntem Namen erhalten die neutrale Standardfarbe – dieses Verhalten bleibt in diesem Schritt unverändert (Hinweistext im Dialog).

## Rechte

Die Datenbank erlaubt Schreibzugriff auf Planungsbereiche bereits ausschliesslich aktiven Admins; Lesezugriff haben alle angemeldeten Benutzer. Es sind keine Datenbank- oder Rechteänderungen nötig. Die Bedienelemente werden zusätzlich in der Oberfläche nur Admins angezeigt.

## Technische Umsetzung

1. `src/lib/master-data.ts`: Mutations-Hooks `useSavePlanningArea` (Insert/Update) und `useDeletePlanningArea` ergänzen, jeweils mit `assertOnline()` und Invalidierung von `["planning_areas"]`. Für das Löschen vorab die Nutzung über `event_planning_areas` zählen (`head`/`count`) und bei Treffern einen sprechenden Fehler werfen.
2. Neue Komponente `src/components/kundivent/planning-area-admin.tsx`: Tabelle mit Admin-Aktionen plus Bearbeiten-Dialog (shadcn `Dialog`, `Input`, `Switch`, `Button`) und Lösch-Bestätigung (`AlertDialog`), Rückmeldungen über Sonner-Toasts – Stil analog zu `user-admin.tsx`.
3. `src/routes/_authenticated/einstellungen.tsx`: Bestehende Planungsbereich-Sektion durch die neue Komponente ersetzen; für Nicht-Admins die aktuelle reine Lese-Tabelle beibehalten. Hinweis „Bearbeitung folgt in einer späteren Phase“ anpassen.
4. Validierung im Dialog: Name nicht leer, keine Namensdopplung (Vergleich ohne Gross-/Kleinschreibung), Nr. als ganze Zahl ≥ 0; Standardwert für neue Bereiche = höchste vorhandene Nr. + 1.
5. Verifikation im Browser: Anlegen, Umbenennen, Deaktivieren, Löschversuch bei benutztem Bereich, Löschen eines unbenutzten Bereichs; danach Prüfung, dass Event-Drawer, Matrix und Bereichsfilter die Änderungen zeigen. Testdaten werden am Ende wieder entfernt.

Datenmodell, RLS und bestehende Eventlogik bleiben unverändert.
