# Daten sichtbar machen + Migration abschliessen

## Was ich geprüft habe

- Die neu hochgeladene Datei ist byte-identisch mit der Datei aus Build 03 (gleiche Prüfsumme) — es ist dieselbe Arbeitsmappe.
- Die Datenbank enthält bereits 86 importierte Einträge mit 89 Bereichszuordnungen (Zeitraum 01.01.2026 bis 18.09.2027), alle aus der Excel-Migration.
- Kein einziger Eintrag mit Review-Flag ist in der Datenbank: die 20 im Preview markierten Datensätze wurden beim Import übersprungen.
- Die Startseite "Übersicht" (`/`) ist noch der Platzhalter aus Build 01 — sie zeigt bewusst keine Daten. Deshalb wirkt die App leer, obwohl die Daten da sind. Unter "Einträge" sind die 86 Datensätze sichtbar.

## Was ich baue

### 1. Übersicht zeigt echte Daten
Der Platzhalter auf der Startseite wird durch eine kompakte, datengetriebene Jahresliste ersetzt:
- Jahresnavigation (2026/2027/2028) wird aktiv und filtert die Einträge.
- Filter für Planungsbereich, Kategorie und Status werden mit den echten Stammdaten verdrahtet.
- Darunter eine nach Monaten gruppierte Liste aller Einträge des Jahres mit Datum, Titel, Bereichen, Kategorie-Farbe, Status und Personenzahl.
- Klick auf einen Eintrag öffnet den bestehenden Event-Drawer zum Bearbeiten.
- Die Umschaltung Timeline/Matrix bleibt als Vorschau markiert (kommt in einer späteren Phase).

### 2. Restliche Migrationsdatensätze importieren
Die 20 im Review markierten Zeilen werden nachgezogen:
- Datei erneut durch den bestehenden Parser laufen lassen.
- Markierte Datensätze mit sinnvollen Vorgaben auflösen (Bereichszuordnung aus der Spalte "Kundelfingerhof AG" → alle betroffenen Bereiche bzw. der plausibelste Bereich; unklare Kategorie → Kategorie "Sonstiges"; unklarer Status → "Idee").
- Import mit gesetztem Review-Kennzeichen, damit diese Einträge in der App als "prüfen" erkennbar bleiben.
- Duplikatschutz über die bestehende Quellreferenz bleibt aktiv, es entstehen keine Doubletten zu den 86 bestehenden Einträgen.

### 3. Review-Sichtbarkeit
- In der Liste "Einträge" ein zusätzlicher Filter "Nur zu prüfen" plus ein kleines Hinweis-Icon in der Zeile bei markierten Datensätzen, damit die 20 nachimportierten Einträge gezielt nachbearbeitet werden können.

### 4. Validierung
- Nach dem Import Abgleich der Gesamtzahl gegen die Quelle (erwartet ca. 106 Einträge) und Gegenprüfung gegen das Blatt "Wochenend-Übersicht"; Ergebnis melde ich als kurze Zusammenfassung.

## Technische Details

- `src/routes/_authenticated/index.tsx`: Platzhalter ersetzt, nutzt `useEvents`, `usePlanningAreas`, `useCategories`, lokaler Jahres-/Filterstate, Gruppierung per `useMemo`.
- `src/routes/_authenticated/eintraege.tsx`: zusätzlicher Review-Filter und Zeilenmarkierung.
- Migration: bestehende Logik in `src/lib/migration/parse.ts` und `import.ts` wiederverwenden; Nachimport der markierten Datensätze einmalig serverseitig ausgeführt und danach in der DB verifiziert.
- Keine Schemaänderung nötig — `migration_review_required` existiert bereits.
