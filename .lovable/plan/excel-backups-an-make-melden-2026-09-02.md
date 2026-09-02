# Excel-Backups an Make melden

Nach jeder erfolgreichen Excel-Sicherung meldet Kundivent die Datei an einen Make-Webhook, damit Make die XLSX-Datei nach Google Drive kopiert. Der Backup-Speicher bleibt privat, Make erhält nur einen zeitlich begrenzten Download-Link.

## Ablauf

1. Excel-Backup wird wie bisher erzeugt und in den privaten Speicher geladen (unverändert).
2. Erst danach: signierter Download-Link mit 15 Minuten Gültigkeit für genau diese Datei.
3. POST an die Make-Webhook-URL mit Header `x-make-apikey` und Payload:
   `type`, `filename`, `download_url`, `created_at`.
4. Ergebnis wird getrennt vom Haupt-Backup protokolliert.

Gilt identisch für das manuelle "Backup jetzt erstellen → Excel" und den wöchentlichen automatischen Lauf – beide nutzen dieselbe Funktion, kein zweiter Code-Pfad.

## Fehlerbehandlung

- Schlägt der Webhook fehl, bleibt das Excel-Backup erfolgreich; nichts wird gelöscht.
- Ein einziger kurzer Wiederholungsversuch, danach Abbruch mit knapper Fehlermeldung (kein Endlos-Retry), Timeout ca. 10 Sekunden.
- Der Status der externen Kopie wird pro Lauf gespeichert: `pending`, `success` oder `failed` samt Zeitpunkt und Fehlertext.
- Fehlt eine der beiden Konfigurationen (URL/Key), bleibt der Status `pending` mit dem Hinweis "nicht konfiguriert".

## UI

In der Admin-Ansicht "Datensicherung" zeigt die Excel-Karte zusätzlich eine Zeile zur externen Kopie, z. B. "Google-Drive-Kopie: erfolgreich · 02.09.2026 03:01" bzw. rot mit Fehlermeldung. Keine weiteren Änderungen am Backup-UI.

## Sicherheit

- Webhook-URL und API-Key werden als serverseitige Secrets hinterlegt (`MAKE_BACKUP_WEBHOOK_URL`, `MAKE_BACKUP_WEBHOOK_API_KEY`) und ausschliesslich im Server-Code gelesen.
- Kein Key im Browser, in Logs, in der UI oder in Backup-Dateien; der Service-Role-Key wird nie an Make gesendet.
- Der Bucket bleibt privat.

## Technische Details

- Migration: `backup_runs` erhält `external_backup_status` (Default `pending`), `external_backup_at`, `external_backup_error`; nur für `excel_export` befüllt. Bestehende Leserechte bleiben (Admins lesen).
- `src/lib/backup.server.ts`: neue interne Funktion `notifyMakeExcelBackup(runId, storagePath, createdAt)` – `createSignedUrl(path, 900, { download: true })`, `fetch` mit `x-make-apikey`, `AbortSignal.timeout`, ein Retry, danach `backup_runs` aktualisieren. Aufruf am Ende von `runExcelExport()` nach dem erfolgreichen Upload/Verify, in `try/catch` gekapselt, sodass das Backup-Ergebnis unverändert zurückgegeben wird. Secrets werden erst innerhalb der Handler aus `process.env` gelesen.
- `src/lib/backups.functions.ts`: `BackupRun`-Typ um die drei neuen Felder erweitert (Overview liefert sie bereits über `select("*")`).
- `src/components/kundivent/backup-admin.tsx`: Statuszeile für die externe Kopie in der Excel-Karte.
- Beide Auslöser (`triggerBackup` und der Cron-Endpunkt `/api/public/backups/run`) rufen bereits `runBackup` auf – dadurch automatisch abgedeckt.

## Test

Manuelles Excel-Backup auslösen und prüfen: XLSX liegt im privaten Speicher, signierter Link funktioniert, Webhook-Aufruf mit korrektem Header und Payload wird ausgeführt, `external_backup_status` steht auf `success`, das Haupt-Backup bleibt unverändert. Ob die Datei in Google Drive ankommt, prüfst du in Make – das liegt ausserhalb von Kundivent.

## Benötigt

Die Make-Webhook-URL und der zugehörige API-Key werden beim Umsetzen abgefragt.
