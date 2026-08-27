# Build 14: E-Mails per Weiterleitung einem Eintrag zuordnen

Jeder Eintrag bekommt eine eigene, zufällige E-Mail-Adresse. Wer eine relevante Mail weiterleitet, sieht sie danach im Eintrag – als Archiv, nicht als Postfach. Kein Senden, kein Antworten, keine Postfach-Anbindung.

## Ablauf für den Nutzer

1. Eintrag öffnen → neuer Abschnitt **Kommunikation** zeigt z. B. `event-a72x9k4p@rinueeldii.resend.app` mit Button **Kopieren** (auch mobil/PWA gut tappbar).
2. Mail im eigenen Mailprogramm an diese Adresse weiterleiten.
3. Kurz darauf erscheint sie im Eintrag unter **E-Mails**: Betreff, Absender, Datum/Zeit, Anzahl Anhänge, kurze Textvorschau.
4. Klick öffnet eine reine Leseansicht mit vollem Text/HTML (sicher bereinigt) und den Anhängen.
5. Anhänge aus Mails landen im bestehenden privaten Dateispeicher und erscheinen bei den Dateien des Eintrags – als „aus E-Mail“ gekennzeichnet.

## Datenbank

- `events.inbound_email_token`: kurzes zufälliges Token (10 Zeichen, a–z0–9), unique, wird beim Anlegen automatisch per Datenbank-Default gesetzt, ändert sich nie. Alle bestehenden Einträge werden per Migration nachträglich mit einem eigenen Token versehen. Token werden nie wiederverwendet.
- Neue Tabelle `event_emails`: `event_id`, `resend_email_id` (unique, Duplikatschutz), `message_id`, `from_address`, `from_name`, `to_address`, `subject`, `text_body`, `html_body`, `received_at`, `created_at`. Indizes auf `event_id`, `received_at`, `resend_email_id`. Lesen für angemeldete Nutzer, Schreiben nur serverseitig.
- `event_attachments` wird erweitert um `event_email_id` (nullable) und `source` (`manual` | `email`, Default `manual`). Manuelle Anhänge funktionieren unverändert weiter.

## Server / Webhook

- Neuer Endpunkt `POST /api/public/webhooks/resend` als TanStack-Start-Serverroute (keine zweite Backend-Architektur).
- Signaturprüfung nach Resend-Vorgabe (Svix-Header) über den unveränderten Roh-Body; ungültige Signatur → 401, keine Verarbeitung.
- Verarbeitet nur `email.received`: Empfängeradresse parsen → Token extrahieren → passenden Eintrag suchen.
- Unbekanntes Token oder unpassende Adresse: nichts anlegen, nichts raten, sauber loggen, 200 zurückgeben (damit Resend nicht endlos wiederholt).
- Bekannte `resend_email_id` bereits vorhanden: sofort Erfolg, kein Duplikat.
- Volle Mail (Body, Anhänge) wird bei Bedarf über die Resend-API mit `RESEND_API_KEY` serverseitig nachgeladen; Schlüssel nie im Browser.
- Anhänge: einzeln in den bestehenden privaten Bucket hochladen, Metadaten mit Bezug zu Eintrag und Ursprungsmail speichern. Scheitert ein Anhang, bleibt die Mail trotzdem gespeichert; der Fehler wird geloggt.
- Logging für ungültige Signatur, unbekanntes Token, Duplikat, Abruf-, Anhang- und Datenbankfehler – ohne unnötige Mailinhalte.

## Oberfläche

- Im Event-Drawer neuer Abschnitt **Kommunikation** mit Adresse + Kopieren + Hinweistext „Relevante E-Mails an diese Adresse weiterleiten. Sie werden automatisch diesem Eintrag zugeordnet.“
- Darunter zwei Tabs **E-Mails | Dateien**; Dateien ist die heutige Anhang-Ansicht.
- E-Mail-Liste chronologisch, neueste zuerst, kompakt; Detailansicht als reine Leseansicht (kein Antworten/Weiterleiten/Löschen).
- Bei neuen, noch nicht gespeicherten Einträgen: Hinweis, dass die Adresse nach dem Speichern verfügbar ist.
- Offline: keine Synchronisation; bereits geladene Kommunikation bleibt sichtbar, Hinweis statt Fehlermeldung.

## Technische Details

- Domain kommt aus der Konfiguration (`RESEND_INBOUND_DOMAIN`, Standard `rinueeldii.resend.app`) und wird über eine zentrale Hilfsfunktion `eventEmailAddress(token)` verwendet – nicht in Komponenten hartkodiert.
- HTML-Bodies werden vor der Anzeige serverseitig/clientseitig bereinigt (keine Scripts, keine Remote-Ausführung); Vorschau nutzt bevorzugt den Textteil.
- Benötigte Secrets, die ich beim Umsetzen abfrage: `RESEND_API_KEY` und `RESEND_WEBHOOK_SECRET` (Signing Secret des Inbound-Webhooks). Danach muss der Webhook in Resend auf die veröffentlichte URL zeigen; Tests funktionieren erst nach dem Publish.
- Bestehende Bereiche bleiben unangetastet: Event-CRUD, Offline-Queue, PWA, Auth, Matrix/Kalender-Ansichten.
