# Build 12: Jahresübersicht & Event-Anhänge

Zwei getrennte Erweiterungen. Bestehende Ansichten (Kalender/Monat, Verfügbarkeit, Matrix), Daten und Design bleiben unverändert.

## Teil A – Jahresübersicht

Neue Ansicht `Jahr` im bestehenden Umschalter der Übersicht: **Monat | Jahr | Verfügbarkeit | Matrix** (der heutige "Kalender"-Knopf wird zu "Monat" umbenannt, gleiche Funktion).

Aufbau:
- Alle 12 Monate des gewählten Jahres als kompakte Mini-Kalender in einem responsiven Raster (4 Spalten auf breitem Desktop, 3 auf kleinerem Desktop, 2 auf Tablet, 1 auf Mobile).
- Jeder Mini-Monat: Wochentagskopf, Tageszahlen, Wochenenden dezent, heutiger Tag markiert.
- Belegte Tage werden farbig hinterlegt – Farbe aus dem bestehenden Planungsbereichs-System inkl. Mehrbereichs-Priorität; ein Event bleibt ein Event (keine Duplikate). Status (bestätigt/provisorisch/Idee/abgesagt) nutzt die bestehende Statusdarstellung.
- Betriebsferien erscheinen als durchgehend markierter Bereich über die betroffenen Tage.
- Wo Platz reicht (breite Bildschirme), zeigt ein Tag mit genau einem Event den gekürzten Titel; sonst nur der Farbmarker. Mehrere Events an einem Tag: Marker plus `+2`-Zähler.

Interaktion:
- Klick auf einen belegten Tag öffnet ein kompaktes Popover mit den Events dieses Tages (Titel, Bereich, Status); Klick auf ein Event öffnet den bestehenden Event-Drawer.
- Klick auf die Monatsüberschrift wechselt in die Monatsansicht dieses Monats.
- Klick auf einen freien Tag: kein neuer Eintrag (Jahr ist reine Übersicht).

Navigation & Filter:
- Kopfzeile im Jahr-Modus: `‹ 2026 ›` plus `Heute`, über denselben URL-Zustand wie heute (kein Hardcoding von Jahren).
- Filter: nur der bestehende Planungsbereichs-Filter bleibt sichtbar; die Sekundärfilter werden im Jahr-Modus ausgeblendet, damit die Ansicht ruhig bleibt.
- Datenquelle: die bereits geladene Event-Liste wird clientseitig auf das Jahr gefiltert – keine zusätzlichen Abfragen.

## Teil B – Anhänge im Event-Drawer

Backend:
- Privater Storage-Bucket `event-attachments`, Limit 20 MB pro Datei, kein öffentlicher Zugriff.
- Neue Tabelle `event_attachments` (event_id, file_name, storage_path, mime_type, file_size, uploaded_by, created_at) mit Löschweitergabe beim endgültigen Löschen eines Events und Zugriffsregeln für angemeldete Benutzer.
- Storage-Regeln: nur angemeldete Benutzer dürfen lesen, hochladen und löschen; Downloads über zeitlich begrenzte, signierte Links.

Drawer:
- Neuer Abschnitt **Anhänge** unten im bestehenden Drawer: Drop-Zone ("Dateien hierher ziehen oder auswählen") plus normaler Datei-Auswahl-Knopf.
- Erlaubte Typen: PDF, DOC/DOCX, XLS/XLSX, JPG/JPEG, PNG, TXT, CSV, EML, MSG. Mehrere Dateien gleichzeitig möglich.
- Zu grosse oder nicht erlaubte Dateien werden mit klarer Fehlermeldung abgelehnt.
- Kompakte Liste je Anhang: Typ-Icon, Dateiname, Grösse, Öffnen/Download, Entfernen (mit kurzer Bestätigung; entfernt Datei und Eintrag, nie das Event).
- Beim Ziehen wird die Drop-Zone hervorgehoben; während des Uploads ein knapper Ladezustand, danach Erfolg oder Fehler.
- Neuer Eintrag: ausgewählte Dateien werden vorgemerkt und erst nach dem Speichern des Events hochgeladen – keine verwaisten Dateien.
- Bestehende und migrierte Events funktionieren unverändert und starten mit null Anhängen.
- `uploaded_by` wird mit dem angemeldeten Benutzer befüllt (nur informativ, keine Rechte pro Benutzer).

Nicht enthalten: Mailbox-Anbindung, E-Mail-Parsing, Versionierung, Ordner, Volltextsuche.

## Technisch

- `src/routes/_authenticated/index.tsx`: Modus `jahr` in `MODES`/`validateSearch`, Kopfzeile jahresweise, Filterleiste im Jahr-Modus reduziert.
- Neu `src/components/kundivent/year-overview.tsx`: 12 Mini-Monate, Tagesindex aus `filteredEvents`, Farben über `src/lib/area-theme.ts`, Betriebsferien über die bestehende Kategorie-Logik.
- Neu `src/lib/attachments.ts`: Query/Mutation-Hooks (Liste, Upload, signierter Download, Löschen) analog zu `src/lib/events.ts`.
- Neu `src/components/kundivent/attachment-section.tsx`, eingebunden in `event-drawer.tsx`; bei neuem Event Upload nach erfolgreichem Speichern.
- Migration für `event_attachments` inkl. Grants und Policies; Bucket wird über das Storage-Werkzeug angelegt.
