# Login Giacomo Zeta funktioniert nicht – Ursache finden und beheben

## Befund (geprüft)

In der Datenbank existieren aktuell nur zwei Konten: `test@kundivent.ch` und `probe@kundivent.ch`. Ein Konto für Giacomo Zeta wurde **nie angelegt** – weder in der Anmeldung noch in der Benutzerliste. Der Login schlägt deshalb zwangsläufig fehl ("Anmeldung fehlgeschlagen"), das ist die Folge, nicht die Ursache.

Auch in den Anmelde-Protokollen ist im fraglichen Zeitraum kein einziger Anlege-Vorgang zu sehen – nur zwei fehlgeschlagene Login-Versuche. Das Speichern im Drawer ist also entweder gar nicht bis zum Server gekommen oder unterwegs abgebrochen. Welche der beiden Varianten zutrifft, ist noch **nicht** bestätigt – das ist der erste Schritt.

## Schritt 1: Reproduktion

Den Ablauf "Einstellungen → Benutzer → + Benutzer → Speichern" mit einem Wegwerf-Konto im Browser nachstellen und dabei mitschneiden:
- Netzwerkantwort des Speichern-Aufrufs (Statuscode, Fehlertext)
- Browser-Konsole
- Server-Fehler

Damit ist eindeutig, ob der Aufruf 401 (fehlende Anmeldeinformation), einen Berechtigungsfehler ("Keine Berechtigung für die Benutzerverwaltung"), einen Fehler des Admin-Zugangs oder gar keinen Aufruf erzeugt.

## Schritt 2: Ursache beheben

Je nach Ergebnis:
- **Aufruf kommt nicht an / 401** → Weitergabe des Anmelde-Tokens an geschützte Server-Aktionen korrigieren.
- **Admin-Zugang schlägt fehl** → Anlegen über den privilegierten Zugang reparieren; Fehler nicht mehr verschlucken.
- **Rechteprüfung schlägt fehl** → Prüfpfad für Admin-Status korrigieren.

## Schritt 3: Fehler sichtbar machen (in jedem Fall)

Heute kann ein Fehlschlag leicht wie ein Erfolg aussehen. Deshalb:
- Der Speichern-Vorgang zeigt bei Fehlern zusätzlich zur Inline-Meldung eine deutliche Fehler-Einblendung; der Drawer bleibt offen.
- Die Erfolgsmeldung erscheint erst, nachdem der neue Benutzer tatsächlich in der neu geladenen Liste vorhanden ist.
- Klartext-Fehlermeldungen statt generischer Texte (z. B. "E-Mail bereits vergeben", "Keine Berechtigung", "Serverfehler").

## Schritt 4: Konto anlegen und verifizieren

Nach dem Fix Giacomo Zeta über die Oberfläche anlegen (E-Mail und Startpasswort wie von dir gewünscht), anschliessend im Browser durchtesten: Login → erzwungener Passwortwechsel → Zugriff auf die App. Zusätzlich wird das Testkonto `probe@kundivent.ch` entfernt.

## Technische Details

- Betroffen: `src/lib/users.functions.ts` (`createUser`, `requireAdmin`, Admin-Client), `src/lib/users.ts` (Mutations-Invalidierung), `src/components/kundivent/user-admin.tsx` (Fehlerdarstellung), ggf. `src/start.ts` (Bearer-Middleware).
- Reproduktion per Playwright gegen die laufende Vorschau mit Netzwerk- und Konsolenmitschnitt.
- Keine Schemaänderung nötig; `profiles`, Trigger und Policies sind vorhanden und korrekt.
