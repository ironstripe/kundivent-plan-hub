# Anhänge aus weitergeleiteten E-Mails sichtbar machen

## Was aktuell passiert

Die Mails selbst kommen an (5 archivierte E-Mails, alle mit Status „stored“). Die Anhänge dagegen werden nicht gespeichert: im Protokoll steht zweimal

`Anhang-Fehler: attachment <Datei>.pdf has no content`

Das heisst: Resend meldet im Webhook zwar, dass ein PDF dabei war (Name, Typ, Grösse), liefert aber weder den Dateiinhalt noch einen Download-Link mit. Unser Code lädt Inhalte nur nach, wenn die Anhangs-Liste komplett fehlt – ist die Liste da (nur ohne Inhalt), wird nichts nachgeladen und der Anhang verworfen. In der Datenbank steht darum kein einziger Anhang aus E-Mail.

## Was gemacht wird

1. **Inhalt aktiv bei Resend nachladen.** Sobald ein Anhang ohne Inhalt und ohne Link ankommt, wird die Mail über die Resend-API erneut abgerufen und – falls nötig – der Anhang einzeln über den Anhangs-Endpunkt geholt. Erst wenn auch das nichts liefert, gilt der Anhang als nicht abrufbar.
2. **Fehler sichtbar machen statt still verlieren.** Im Protokoll unter Einstellungen wird pro Anhang festgehalten, ob er gespeichert wurde oder warum nicht (kein Inhalt, Download-Fehler, Speicherfehler). Beim Öffnen eines Eintrags erscheint bei nicht abrufbaren Anhängen ein kurzer Hinweis statt gar nichts.
3. **Diagnose-Schritt vorab.** Da unklar ist, welche Felder Resend genau mitschickt, wird die Anhangs-Struktur der nächsten eingehenden Mail (nur Feldnamen, keine Inhalte) einmalig ins Protokoll geschrieben, damit der richtige Abruf-Weg belegt ist und nicht geraten wird.
4. **Nachziehen der bereits eingegangenen Mails.** Für die 5 bereits archivierten Mails wird ein Admin-Knopf im Protokoll ergänzt, der die Anhänge nachträglich abholt, sofern Resend sie noch vorhält.

Die bestehenden manuellen Datei-Uploads, die E-Mail-Ansicht und alles andere bleiben unverändert.

## Technisch

- `src/routes/api/public/webhooks/resend.ts`: `fetchFullEmail` auch aufrufen, wenn Anhänge vorhanden, aber ohne `content`/`content_url`; `storeAttachment` um Abruf über die Resend-Anhangs-Endpunkte (`/emails/inbound/{id}/attachments/...`) erweitern; Ergebnis je Anhang sammeln und in `inbound_email_log.detail` schreiben.
- Einmalige Feldnamen-Diagnose der Anhangs-Objekte im Log (keine Inhalte, keine Adressen).
- Neue interne Serverfunktion „Anhänge nachladen“ für bestehende `event_emails`, aufrufbar aus `inbound-email-log.tsx` (nur Admins).
- Kein Schema-Wechsel nötig: `event_attachments` hat bereits `event_email_id` und `source`.
- Test erst nach dem Veröffentlichen möglich, da Resend nur die Live-URL aufruft.
