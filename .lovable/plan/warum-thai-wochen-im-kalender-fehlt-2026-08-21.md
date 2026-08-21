# Warum "Thai Wochen" im Kalender fehlt

## Befund

Kein Filter- oder Datenfehler. "Thai Wochen" liegt vom **08.01.2026 bis 25.01.2026** (Restaurant / À la Carte, bestätigt).

Der gezeigte Kalender-Screenshot ist **Januar 2027**, nicht Januar 2026: der Monat beginnt mit Mo 28.–Do 31. (Dezember) und der 1. liegt auf einem Freitag — das trifft nur auf 2027 zu. In diesem Zeitraum existieren in der Datenbank nur die beiden Betriebsferien-Blöcke (21.12.2026–31.12.2026 und ab 25.01.2027), genau wie im Screenshot.

Im Kalender für Januar **2026** wird "Thai Wochen" korrekt als durchgehender Balken über drei Wochenzeilen dargestellt (verifiziert im laufenden Preview).

## Ursache der Verwirrung

Die Matrix zeigt ein **ganzes Jahr** und wird frei gescrollt; der Monats-/Jahres-Kopf oben ändert sich beim Scrollen nicht mit. Beim Wechsel Matrix → Kalender wird der Monat aus dem Kopf verwendet, nicht die Stelle, an der man in der Matrix gerade gelesen hat. So landet man leicht in einem anderen Jahr als erwartet.

## Vorschlag (optional)

1. Matrix-Scrollposition an den Monatskopf koppeln: beim Scrollen den aktuell sichtbaren Monat erkennen und `y`/`m` in der URL sowie den Kopf aktualisieren (Scroll-Observer auf die Monatstrenner in `matrix-view.tsx`).
2. Damit übernimmt der Wechsel zu Kalender/Verfügbarkeit automatisch den zuletzt betrachteten Monat.
3. Zusätzlich: Jahreszahl im Kopf immer anzeigen (aktuell "Januar 2026" — bereits vorhanden, in der Matrix aber statisch), damit der Bezug klar bleibt.

## Technisch

- Betroffen: `src/components/kundivent/matrix-view.tsx` (IntersectionObserver auf den Monats-Zeilen), `src/routes/_authenticated/index.tsx` (Callback `onMonthChange` → `patchSearch({ y, m })`, mit Guard gegen Rückkopplung mit `jumpMonth`).
- Keine Änderungen an Datenmodell, Filterlogik oder Abfragen.
