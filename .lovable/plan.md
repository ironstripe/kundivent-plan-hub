# Monats-/Jahres-Auswahl in der Übersicht

Die Beschriftung oben links („August 2026") ist derzeit nur Text – navigiert wird ausschliesslich mit den Pfeilen. Weit entfernte Monate zu erreichen dauert dadurch lange.

## Was gebaut wird

Die Beschriftung wird zu einer klickbaren Schaltfläche mit kleinem Auswahl-Panel:

- **Jahr**: Zeile mit `‹ 2026 ›` zum Blättern plus Dropdown für einen Sprung über mehrere Jahre (aktuelles Jahr ±5).
- **Monat**: 3×4-Raster mit Kurznamen (Jan … Dez); der aktive Monat ist hervorgehoben, das Panel schliesst nach der Auswahl.
- **Heute**-Verknüpfung bleibt wie bisher separat rechts daneben.

Das ist schneller als zwei getrennte Dropdowns und passt zum kompakten Yeti-Stil.

```text
[ ‹ ]  August 2026 ▾  [ › ]  [ Heute ]
        ┌───────────────────────┐
        │  ‹   2026 ▾   ›       │
        │  Jan Feb Mär Apr      │
        │  Mai Jun Jul [Aug]    │
        │  Sep Okt Nov Dez      │
        └───────────────────────┘
```

Gilt für alle drei Modi (Kalender, Verfügbarkeit, Matrix), da alle denselben Monats-Cursor nutzen – die Matrix springt wie gewohnt zum gewählten Monat.

## Technisch

- Datei: `src/routes/_authenticated/index.tsx`. Der `<h1>`-Monatstitel wird durch einen `Popover` mit `PopoverTrigger` (Ghost-Button, gleiche Breite/Typografie wie jetzt) ersetzt.
- Auswahl schreibt in denselben Cursor-Zustand (URL-Suchparameter), den `shiftMonth` verwendet – keine neue Zustandsquelle.
- Keine Datenbank- oder Logikänderungen; reine UI-Ergänzung.
