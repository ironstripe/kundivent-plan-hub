# Inbound-Mails kommen nicht an – Diagnose & Fix

## Was ich geprüft habe

- Der veröffentlichte Endpoint `https://kundivent-plan-hub.lovable.app/api/public/webhooks/resend` ist erreichbar und antwortet korrekt mit 401 auf unsignierte Anfragen.
- In der Datenbank: **0 Einträge** in `event_emails` und **0 Einträge** im Zustellprotokoll `inbound_email_log`.

Das Protokoll schreibt jede eingehende Zustellung – auch solche ohne Token oder mit unbekanntem Token. Dass es leer ist, bedeutet: **Resend ruft unseren Webhook gar nicht auf.** Der Fehler liegt also nicht im Parsing, sondern in der Resend-Konfiguration.

Zweiter, unabhängiger Fehler: die getestete Adresse `583549e157+583549e157@rinueeldii.resend.app` enthält als Plus-Teil erneut den Mailbox-Namen statt des Eintrags-Tokens. Auch bei funktionierendem Webhook würde das als „kein Token“ protokolliert. Die korrekte Adresse steht im Eintrag unter „Kommunikation“ und sieht aus wie `583549e157+<10-stelliger-Token>@rinueeldii.resend.app`.

## Wahrscheinliche Ursachen (in dieser Reihenfolge zu prüfen)

1. In Resend ist kein Webhook-Endpoint auf die Produktions-URL registriert, oder er ist ohne das Event `email.received` angelegt.
2. Der Webhook zeigt auf eine andere URL (z. B. Preview-URL, die für Resend nicht erreichbar ist).
3. Das in Lovable hinterlegte `RESEND_WEBHOOK_SECRET` stammt nicht von genau diesem Endpoint – dann verwirft unser Handler die Zustellung mit 401, bevor geloggt wird.
4. Für die Sandbox-Domain ist keine Inbound-Regel aktiv, die Mails an den Webhook weiterleitet.

## Vorgehen (Fokus: Signing-Secret)

Da du die Webhook-URL in Resend geändert, das Signing-Secret aber nicht neu hinterlegt hast, ist Ursache 3 die wahrscheinlichste: Resend ruft uns auf, unser Handler verwirft die Zustellung aber mit 401, bevor irgendetwas protokolliert wird – deshalb ist das Protokoll leer.

1. Signaturfehler werden künftig zuerst protokolliert (Ergebnis „Signatur ungültig“, nur Metadaten, kein Inhalt). Danach zeigt „Einstellungen → Zustellprotokoll“ sofort den Unterschied zwischen „Resend ruft nicht auf“ und „Secret falsch“.
2. ✅ Erledigt: Das aktuelle Signing-Secret (`whsec_…`) aus Resend wurde als `RESEND_WEBHOOK_SECRET` hinterlegt.
3. Kontrollcheck über die Resend-API: registrierter Endpoint zeigt auf `https://kundivent-plan-hub.lovable.app/api/public/webhooks/resend` und `email.received` ist aktiviert.
4. Kleiner UI-Schutz in der „Kommunikation“-Sektion: Hinweistext, dass nur die dort angezeigte Adresse (mit dem Eintrags-Token) funktioniert – `583549e157+<token>@…`, nicht Mailbox+Mailbox – plus der Betreff-Code `#<token>` als Alternative.
5. Nach dem Veröffentlichen: Testmail an die im Eintrag angezeigte Adresse; das Protokoll zeigt das Ergebnis sofort.


## Technische Details

- Betroffene Dateien: `src/routes/api/public/webhooks/resend.ts` (Logging vor der Signaturprüfung), `src/components/kundivent/communication-section.tsx` (Hinweis).
- Keine Schema-Änderung nötig; `inbound_email_log` deckt den neuen Ergebnistyp ab.
