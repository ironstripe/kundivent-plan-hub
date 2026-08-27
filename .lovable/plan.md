# Anhänge aus weitergeleiteten E-Mails sichtbar machen

## Was aktuell passiert

Die Mails selbst kommen an (5 archivierte E-Mails, alle mit Status „stored“). Die Anhänge dagegen werden nicht gespeichert: im Protokoll steht zweimal

`Anhang-Fehler: attachment <Datei>.pdf has no content`

Das heisst: der Webhook meldet zwar, dass ein PDF dabei war (Name, Typ, Grösse), enthält aber weder den Dateiinhalt noch einen Link. Bei Resend selbst liegen die Anhänge vollständig vor und sind dort herunterladbar – wir holen sie nur nicht ab. Unser Code lädt nämlich nur nach, wenn die Anhangs-Liste komplett fehlt; ist sie da (nur ohne Inhalt), wird nichts nachgeladen und der Anhang verworfen. Darum steht in der Datenbank kein einziger Anhang aus E-Mail.

## Was gemacht wird

1. **Anhänge aktiv bei Resend abholen.** Kommt ein Anhang ohne Inhalt an, wird die Mail über die Resend-API mit dem vorhandenen API-Schlüssel erneut geladen und der Anhang über den dort gelieferten Download-Weg geholt – genau die Datei, die du im Resend-Dashboard herunterladen kannst. Danach landet sie im privaten Dateispeicher und erscheint beim Eintrag unter „Dateien“, gekennzeichnet als „aus E-Mail“.
2. **Fehler sichtbar machen statt still verlieren.** Im Protokoll unter Einstellungen wird pro Anhang festgehalten, ob er gespeichert wurde oder warum nicht (kein Inhalt, Download-Fehler, Speicherfehler).
3. **Nachziehen der bereits eingegangenen Mails.** Für die 5 bereits archivierten Mails kommt ein Admin-Knopf ins Protokoll, der die Anhänge nachträglich abholt, sofern Resend sie noch vorhält.


Die bestehenden manuellen Datei-Uploads, die E-Mail-Ansicht und alles andere bleiben unverändert.

## Technisch

- `src/routes/api/public/webhooks/resend.ts`: `fetchFullEmail` auch aufrufen, wenn Anhänge vorhanden, aber ohne `content`/`content_url`; `storeAttachment` um Abruf über die Resend-Anhangs-Endpunkte (`/emails/inbound/{id}/attachments/...`) erweitern; Ergebnis je Anhang sammeln und in `inbound_email_log.detail` schreiben.
- Einmalige Feldnamen-Diagnose der Anhangs-Objekte im Log (keine Inhalte, keine Adressen).
- Neue interne Serverfunktion „Anhänge nachladen“ für bestehende `event_emails`, aufrufbar aus `inbound-email-log.tsx` (nur Admins).
- Kein Schema-Wechsel nötig: `event_attachments` hat bereits `event_email_id` und `source`.
- Test erst nach dem Veröffentlichen möglich, da Resend nur die Live-URL aufruft.
