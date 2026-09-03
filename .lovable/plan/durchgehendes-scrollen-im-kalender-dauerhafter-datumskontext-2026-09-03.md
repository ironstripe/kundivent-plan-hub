# Durchgehendes Scrollen im Kalender & dauerhafter Datumskontext

## Ziel

Der Monatskalender wird zu einer durchgehenden chronologischen Planungsfläche: Nutzer scrollen ohne Bruch von September in Oktober und wieder zurück, sehen jederzeit oben, welcher Monat gerade aktiv ist, und alle bestehenden Bedienelemente (Vor/Zurück, Monatsauswahl, Heute, globale Suche) bleiben damit synchron.

## Was sich ändert

### 1. Monatsansicht: durchgehendes Scrollen

- Statt genau eines Monats rendert die Kalenderansicht eine Folge von Monaten untereinander, jeder weiterhin als bestehendes 7-Spalten-Wochenraster mit unveränderter Event-Darstellung.
- Zwischen den Monaten steht eine schlanke Trennzeile im bestehenden Stil: dünne Linie mit zentriertem Label „Oktober 2026".
- Tage aus Nachbarmonaten behalten die bestehende gedämpfte Darstellung.
- Es entsteht kein Agenda-/Listenlayout und kein zusätzlicher innerer Scrollcontainer – gescrollt wird die normale Seite (gut für Mobile/PWA).

### 2. Klebender Monats-/Jahreskontext

- Die bestehende Toolbar (Monatstitel, Pfeile, Heute, Datumsauswahl, Suche, Filter) wird unter der App-Kopfzeile klebend fixiert und kompakt gehalten, damit sie auf kleinen Displays wenig Höhe braucht.
- Beim Scrollen wechselt der angezeigte Monatstitel auf den Monat, der den Hauptteil des sichtbaren Bereichs einnimmt. Ein Schwellwert plus Hysterese verhindert Flackern genau an der Monatsgrenze.
- Die Erkennung nutzt dasselbe Muster, das die Matrix bereits erfolgreich verwendet (Scroll-Beobachtung mit Monats-Ankern, per Animation-Frame gedrosselt).

### 3. Navigation bleibt synchron

- Monatsauswahl, Vor/Zurück und „Heute" scrollen im durchgehenden Kalender an die passende Stelle, statt die Ansicht auszutauschen.
- Scrollt der Nutzer selbst in einen anderen Monat, wird der Zustand in der URL (`y`, `m`) still nachgeführt – wie es die Matrix heute schon tut. Angezeigter und gespeicherter Monat können nicht auseinanderlaufen.

### 4. Globale Suche

- Ein Klick auf ein Suchergebnis nutzt weiterhin die bestehende Navigationsfunktion: sie stellt den Zielmonat im Fenster sicher, scrollt zum konkreten Tag, setzt den Monatskontext und öffnet den Eintrag wie bisher. Keine zweite Navigationslogik.

### 5. Nachladen / Performance

- Gerendert wird ein Fenster von zunächst je zwei Monaten vor und nach dem aktiven Monat. Nähert sich der Nutzer dem oberen oder unteren Rand, kommen weitere Monate dazu.
- Werden Monate oben eingefügt, wird die Scrollposition vor dem Zeichnen korrigiert, damit die Ansicht nicht springt.
- Die Ereignisdaten kommen weiterhin aus der bestehenden, einmal zwischengespeicherten Abfrage, auf der auch Verfügbarkeit, Matrix und Offline-Betrieb aufsetzen. Das Fenster begrenzt die Renderarbeit; die Datenabfrage selbst bleibt unangetastet, damit Rechte, Offline-Synchronisierung und Verfügbarkeitsberechnung unverändert funktionieren.

### 6. Übrige Zeitansichten (nur Orientierung, keine Umbauten)

- Jahresübersicht: Struktur bleibt; die Monatsüberschriften der Monatsblöcke werden beim Scrollen klebend, plus klebende Toolbar mit Jahreszahl.
- Matrix: bleibt funktional und strukturell unverändert; sie hat bereits klebende Kopfzeilen und Monatssynchronisation.
- Verfügbarkeit: Logik unverändert; nutzt denselben klebenden Kopfbereich, damit Monat/Jahr sichtbar bleibt. Kein durchgehendes Scrollen hier.
- Radar Beta: Datenquellen, Filter und Abfragen bleiben unverändert; der Kopfbereich mit Monats-/Jahresangabe wird klebend.
- Einträge: keine strukturelle Änderung.

## Nicht betroffen

Datenmodell, Migrationen, Planungsbereiche, Kategorien/Status, Berechtigungen, Bearbeitung, Drag-and-Drop, Anzahlungs-Markierung, Anhänge, Verantwortlichkeiten, Offline/PWA, Radar-Datenlogik, globale Suchlogik, Designsystem, TanStack-Architektur.

## Technische Umsetzung

- Neuer gemeinsamer Baustein `src/components/kundivent/month-scroller.tsx`: verwaltet das Monatsfenster (Erweitern nach oben/unten, Scrollpositions-Korrektur), registriert Monats-Anker und meldet den aktiven Monat.
- Neuer Hook `src/hooks/use-active-month.ts` (oder gleichwertige Datei in `src/lib`): kapselt die Erkennung des aktiven Monats mit Hysterese; wird vom Monats-Scroller und der Jahresübersicht genutzt, Matrix behält ihre bestehende, bereits funktionierende Variante.
- `src/components/kundivent/month-calendar.tsx` wird für eine Monatsscheibe wiederverwendet: Wochenkopf wird auf Ebene des Scrollers einmal klebend gerendert, das Wochenraster und die gesamte Event-Segmentlogik bleiben unverändert.
- `src/routes/_authenticated/index.tsx`: Kalendermodus rendert den Scroller statt einer einzelnen Monatsinstanz; `goToMonth`, `shiftMonth`, `goToday` und `selectSearchResult` bekommen ein gemeinsames Ziel (Monat + optionales Datum) über einen `scrollTarget`-Zustand analog zum bestehenden `jumpMonth` der Matrix; Scroll-Rückmeldung aktualisiert `y`/`m` per `replace`-Navigation.
- Verfügbarkeitsmodus rendert weiterhin genau einen Monat (kein Fenster), damit die Berechnung unverändert bleibt.
- Klebende Kopfbereiche verwenden `sticky` unterhalb der bestehenden App-Kopfzeile (`top-12`) mit `env(safe-area-inset-top)`-tauglicher Höhe wie in „Freie Termine" bereits vorhanden.
- Keine Datenbankänderung, keine neuen Abfragen.

## Prüfung nach Umsetzung

Scrollen vorwärts/rückwärts über mehrere Monatsgrenzen, kein Springen beim Nachladen nach oben, kein Flackern des Monatstitels, Monatsauswahl/Pfeile/Heute, Suchergebnis in einem anderen Monat öffnet den Eintrag am richtigen Tag, Drag-and-Drop und Bearbeiten weiterhin intakt, Darstellung auf Mobilbreite.
