# Durchgehendes Scrollen in der Jahresübersicht

## Ziel

Die Jahresübersicht wird — wie der Monatskalender — zu einer durchgehenden Zeitfläche: Nutzer scrollen ohne Bruch von 2026 nach 2027 und zurück, sehen jederzeit oben, welches Jahr gerade aktiv ist, und Pfeile, Monats-/Jahresauswahl, „Heute" und die globale Suche bleiben damit synchron.

## Was sich ändert

### 1. Jahresansicht scrollt durchgehend

- Statt genau eines Jahres rendert die Jahresübersicht eine Folge von Jahren untereinander, jedes weiterhin als bestehendes 12-Monats-Raster mit unveränderten Mini-Monaten und Event-Darstellung.
- Zwischen den Jahren steht eine schlanke Trennzeile im bestehenden Stil (dünne Linie mit zentriertem Label „2027"), analog zu den Monatstrennern im Kalender.
- Gescrollt wird die normale Seite, kein zusätzlicher innerer Scrollcontainer (gut für Mobile/PWA).

### 2. Klebender Jahreskontext

- Die bestehende klebende Toolbar bleibt; der angezeigte Jahrestitel wechselt beim Scrollen auf das Jahr, das den sichtbaren Bereich dominiert (mit Schwellwert, damit es an der Jahresgrenze nicht flackert).
- Die klebenden Monatsüberschriften der Mini-Monate bleiben unverändert erhalten.

### 3. Navigation bleibt synchron

- Pfeile (Jahr vor/zurück), Jahresauswahl und „Heute" scrollen an die passende Stelle, statt die Ansicht auszutauschen.
- Scrollt der Nutzer selbst in ein anderes Jahr, wird `y` in der URL still nachgeführt (ohne Scroll-Reset), genau wie im Monatskalender.
- Ein Klick auf einen Mini-Monat wechselt weiterhin in den Kalendermodus dieses Monats.
- Globale Suche: ein Treffer scrollt zum Jahr des Eintrags und öffnet ihn wie bisher.

### 4. Nachladen / Performance

- Gerendert wird ein gleitendes Fenster von zunächst je einem Jahr vor und nach dem aktiven Jahr; beim Annähern an den Rand kommen Jahre dazu, am gegenüberliegenden Ende fallen sie weg — kein festes Endjahr.
- Beim Einfügen oben wird die Scrollposition vor dem Zeichnen korrigiert, damit die Ansicht nicht springt.
- Datenquelle bleibt die bestehende, einmal zwischengespeicherte Abfrage; keine neuen Queries, keine Datenbankänderung.

## Nicht betroffen

Datenmodell, Migrationen, Berechtigungen, Bearbeitung, Drag-and-Drop, Anzahlungs-Markierung, Anhänge, Offline/PWA, Matrix, Verfügbarkeit, Radar, Monatskalender-Verhalten, Designsystem, TanStack-Architektur.

## Technische Umsetzung

- `src/components/kundivent/year-overview.tsx` wird für eine Jahresscheibe wiederverwendet (bestehendes 12-Monats-Grid, unveränderte `buildDayIndex`- und `MiniMonth`-Logik).
- Neuer `src/components/kundivent/year-scroller.tsx` nach demselben Muster wie `month-scroller.tsx`: gleitendes Jahresfenster, Anker-Refs pro Jahr, Scroll-Kompensation via `useLayoutEffect`, aktive-Jahr-Erkennung pro Animation Frame, Ziel-Scroll über einen `ScrollTarget` mit Nonce.
- `src/routes/_authenticated/index.tsx`: Jahresmodus rendert den Year-Scroller; `shiftYear`, Jahresauswahl, `goToday` und `selectSearchResult` setzen ein gemeinsames Scrollziel; Rückmeldung aktualisiert `y` per `replace`-Navigation mit `resetScroll: false`.
- Der gemessene Toolbar-Offset (`ResizeObserver`) wird als `stickyOffset`/`headerOffset` weitergereicht wie beim Monatskalender.

## Prüfung nach Umsetzung

Vorwärts/rückwärts über mehrere Jahresgrenzen scrollen, kein Springen beim Nachladen oben, kein Flackern des Jahrestitels, Pfeile/Jahresauswahl/Heute, Suchtreffer in anderem Jahr, Klick auf Mini-Monat, Darstellung auf Mobilbreite.
