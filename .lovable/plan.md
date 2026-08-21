# Matrix: Monatswahl scrollt nicht mit

## Problem

In der Matrix-Ansicht ändert die Monatsnavigation oben links (Pfeile, "Heute") nur die Kopfzeile. Die Matrix selbst springt nur beim Wechsel in den Matrix-Modus zum Monat — danach bleibt sie stehen, weshalb oben "August 2026" steht, unten aber noch Januar sichtbar ist.

Ursache (verifiziert in `src/routes/_authenticated/index.tsx`): `shiftMonth()` und "Heute" aktualisieren nur die URL-Parameter; das `jumpMonth`-Signal an die Matrix wird ausschliesslich in `switchMode()` gesetzt.

## Lösung

1. Bei jeder Monatsänderung im Matrix-Modus zusätzlich das Scroll-Signal auslösen — in `shiftMonth()` und "Heute" `setJumpMonth({ index: <neuer Monat>, nonce: Date.now() })` setzen.
2. Rückkopplung vermeiden: Der Scroll-Listener der Matrix meldet den sichtbaren Monat zurück. Damit ein programmatischer Sprung nicht sofort wieder überschrieben wird, wird die Rückmeldung während eines laufenden Sprungs kurz unterdrückt (Ziel-Monat merken, erst wieder melden, wenn er erreicht ist).
3. Jahreswechsel: Wenn die Monatsnavigation über die Jahresgrenze geht, erst nach dem Neuaufbau der Tage scrollen (Sprung über das bestehende `nonce`-Signal auslösen, das nach dem Jahres-Reset greift).

## Technische Details

- Betroffene Dateien: `src/routes/_authenticated/index.tsx` (Monatsnavigation + Jump-Signal), `src/components/kundivent/matrix-view.tsx` (Unterdrückung der Scroll-Rückmeldung während eines Sprungs, Reihenfolge von Jahres-Reset und Jump).
- Keine Daten- oder Backend-Änderungen.
