# Anzahlung im Eintrag erfassen

## Ziel
Im Eintrags-Formular zwei neue Felder ergänzen:
- Checkbox **„Anzahlung erhalten"**
- Zahlenfeld **„Betrag (CHF)"** für den bezahlten Betrag

## Umsetzung

### Datenbank
Tabelle `events` erhält zwei Spalten:
- `deposit_received` (Ja/Nein, Standard: Nein)
- `deposit_amount` (Betrag, optional)

### Formular (Neuer/Bearbeiten Eintrag)
- Neuer Abschnitt unter „Personen / Bemerkungen": Checkbox „Anzahlung erhalten" plus Betragsfeld.
- Das Betragsfeld ist nur aktiv, wenn die Checkbox gesetzt ist; wird die Checkbox entfernt, wird der Betrag geleert.
- Validierung: Betrag muss eine Zahl ≥ 0 sein (max. 2 Nachkommastellen), sonst Fehlermeldung am Feld.
- Speichern und Laden bestehender Einträge berücksichtigen beide Werte.

### Anzeige
- In der Einträge-Tabelle wird bei erhaltener Anzahlung ein kleiner Hinweis (z. B. „Anzahlung CHF 500") in der Detailspalte angezeigt.
- Kalender/Matrix bleiben unverändert.

## Technische Details
- Migration: `ALTER TABLE public.events ADD COLUMN deposit_received boolean NOT NULL DEFAULT false, ADD COLUMN deposit_amount numeric(10,2)`.
- Anpassungen in `src/lib/events.ts` (Typen, Insert/Update-Mapping) und `src/components/kundivent/event-drawer.tsx` (FormState, Validierung, UI).
- Anzeige-Ergänzung in `src/routes/_authenticated/eintraege.tsx`.
