# Excel-Abgleich (Build 15) – kontrollierter Update-Import

Der Excel-Import wird von einer Einmal-Migration zu einem wiederholbaren, kontrollierten Abgleich: Änderungen aus der Excel-Datei werden erkannt, vorab angezeigt und erst nach ausdrücklicher Bestätigung übernommen. Es wird nie automatisch gelöscht oder abgesagt, und manuell in Kundivent erfasste Einträge bleiben komplett unberührt.

## Ausgangslage (geprüft)

- 86 Einträge stammen aus Excel (`migration_source = kundelfingerhof_excel`), 7 sind manuell erfasst.
- Die heutige Quellreferenz enthält Datum und Titel, z. B. `2026|Bankett/Event|2026-08-22|2026-08-22|hochzeit-stroppel-&-schlatter-50-pax`. Ändert sich Datum oder Titel in Excel, entsteht heute ein Duplikat statt einer Aktualisierung.
- Titel allein reicht als Identität nicht: z. B. «First Friday SH» kommt in derselben Spalte mehrfach an verschiedenen Daten vor.

## Wiedererkennung derselben Veranstaltung

Da die Excel-Datei keine feste ID-Spalte hat, wird in mehreren Stufen zugeordnet (jeweils eindeutig, 1:1):

1. Voller Schlüssel identisch (Blatt + Spalten + Datumsbereich + Titel) → sicher dieselbe Veranstaltung.
2. Blatt + Spalten + Datumsbereich identisch, Titel geändert → Umbenennung.
3. Blatt + Spalten + Titel identisch, Datum verschoben → Verschiebung, aber nur wenn auf beiden Seiten genau ein Kandidat übrig bleibt.
4. Mehrere mögliche Kandidaten → «Prüfung nötig»; der Anwender kann im Detaildialog wählen: als neuer Eintrag anlegen oder einem bestehenden Eintrag zuordnen.

Der beim Übernehmen geschriebene Schlüssel (`migration_source_key`) wird für die bestehenden 86 Einträge einmalig aus der vorhandenen Referenz übernommen, damit nichts bricht.

## Klassifizierung und Vorschau

Nach der Dateiauswahl wird nur gelesen und verglichen – keine Datenbankschreibung. Angezeigt wird:

```text
Excel-Abgleich

Neu                12
Geändert            8
Unverändert       143
Fehlt in Excel      3
Prüfung nötig       2
```

- Filter: Alle · Neu · Geändert · Unverändert · Fehlt in Excel · Prüfung nötig.
- Bei «Geändert» zeigt der Detaildialog nur die abweichenden Felder mit Alt/Neu (Datum, Pax, Status, Titel, Kategorie, Bereiche, Bemerkungen).
- Verglichen wird normalisiert: leer = leer, Leerzeichen und Datumsformat vereinheitlicht, Planungsbereiche als Menge ohne Reihenfolge. Ganztags-Einträge ohne Zeiten gelten als gleich.
- «Fehlt in Excel» listet importierte Einträge, die in der neuen Datei nicht mehr vorkommen, mit den Aktionen «Ignorieren» und «Eintrag öffnen». Kein Löschen, kein automatisches Absagen, keine Statusänderung.

## Übernahme

Primäraktion: **Excel-Abgleich übernehmen**. Darüber dauerhaft sichtbar der Hinweis:

`Der Excel-Abgleich aktualisiert nur Einträge, die ursprünglich aus Excel stammen. Manuell in Kundivent erfasste Einträge bleiben unverändert. Einträge werden nie automatisch gelöscht.`

- Neu → Eintrag anlegen inkl. Planungsbereichen.
- Geändert → bestehenden Eintrag aktualisieren, gleiche Eintrags-ID, nur Excel-Felder.
- Unverändert → nichts schreiben.
- Prüfung nötig → wird nur übernommen, wenn der Anwender sie im Dialog freigegeben hat.
- Fehlt in Excel → nur markieren.

Excel darf ausschliesslich verändern: Titel, Kategorie, Datum/Zeiten, Ganztags-Kennzeichen, Status, Pax, Bemerkungen, Planungsbereiche, Prüf-Kennzeichen und Sync-Metadaten. Unberührt bleiben: verantwortliche Person, E-Mail-Adresse des Eintrags (`inbound_email_token`), Dateianhänge, E-Mail-Verlauf, Ersteller, Offline-Metadaten.

Abschlussmeldung:

```text
Excel-Abgleich abgeschlossen

Neu erstellt: 12
Aktualisiert: 8
Unverändert: 143
Fehlt in Excel: 3
Fehlgeschlagen: 0
```

Fehlgeschlagene Quellsätze werden einzeln mit Grund aufgeführt.

## Technische Umsetzung

**Datenbank (eine Migration)**

- `events.migration_source_key text` (Index auf `(migration_source, migration_source_key)`), einmalig aus `migration_source_ref` befüllt.
- `events.migration_missing_from_source boolean not null default false`.
- `events.last_import_batch_id text` (z. B. `excel-sync-20260831-151100-a1b2`).
- RPC `public.apply_excel_event_sync(...)` (SECURITY INVOKER, für `authenticated`): aktualisiert bzw. erstellt einen Eintrag samt Planungsbereichs-Verknüpfungen in einer Transaktion, sodass kein halb aktualisierter Zustand entstehen kann. Setzt `last_synced_at`, `sync_status`, Batch-ID; rührt Kundivent-eigene Felder nicht an.

**Parser (`src/lib/migration/parse.ts`)**

- Bestehende Lese-/Konsolidierungslogik bleibt unverändert (Blätter 2026–2028, Wochenend-Übersicht weiterhin nur Validierung).
- `MigrationRecord` erhält zusätzlich `sourceKey` (Blatt + sortierte Spalten + Titel-Slug) sowie `dateKey`; `ref` bleibt für Kompatibilität erhalten.

**Neuer Vergleich (`src/lib/migration/diff.ts`)**

- Lädt einmalig alle Excel-Einträge inkl. Bereichs-Verknüpfungen, Kategorien und Planungsbereiche (kein Query pro Zeile).
- Führt die vierstufige Zuordnung aus, normalisiert und liefert pro Datensatz Klassifikation und Feld-Diffs sowie die Liste «Fehlt in Excel».

**Anwenden (`src/lib/migration/import.ts`)**

- `useApplyExcelSync` ruft je Datensatz die RPC auf, sammelt Erfolge/Fehler und markiert am Ende `migration_missing_from_source` (setzen und wieder zurücksetzen).

**UI (`src/routes/_authenticated/migration.tsx`)**

- Titel «Excel-Abgleich», Subline «Aktualisiert bestehende Excel-Einträge in Kundivent und übernimmt neue Einträge.»
- Zählkacheln, neue Filter, Diff-Dialog, Bereich «Fehlt in Excel», Ergebnis-Zusammenfassung.

Nicht Teil dieses Builds: automatisches Löschen oder Absagen, Excel-Export, Datei-Überwachung, Cloud-Sync, geplante Importe, Versionierung.

## Abschliessender Test

Mit einer Kopie der aktuellen Arbeitsmappe: identische Datei (0 neu, 0 geändert), geänderter Eintrag (1 geändert, gleiche ID, Verantwortliche/Anhänge/E-Mail-Adresse unverändert), neuer Eintrag (1 neu), entfernter Eintrag (1 fehlt in Excel, nichts gelöscht), manueller Kundivent-Eintrag unberührt, Wiederholung ohne Duplikate.
