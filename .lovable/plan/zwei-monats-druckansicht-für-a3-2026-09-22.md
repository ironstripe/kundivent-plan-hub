# Zwei-Monats-Druckansicht für A3

## Ziel
Die Monatsansicht erhält eine dezente Aktion „Drucken“. Sie öffnet den normalen Browser-Druckdialog und druckt ausschliesslich den aktuell angezeigten sowie den unmittelbar folgenden Monat auf einer kompakten A3-Seite im Querformat.

## Umsetzung
- Eine eigenständige Druckdarstellung für zwei Monate ergänzen, ohne die bestehende Bildschirm-Kalenderansicht zu verändern.
- Den aktuellen Monat aus dem sichtbaren Kalenderzustand übernehmen und den Folgemonat dynamisch berechnen, einschliesslich Dezember–Januar-Wechsel.
- Dieselbe bereits gefilterte Ereignisliste, Bereichsfarben und Statuslogik verwenden; keine zweite Datenabfrage oder Datenhaltung einführen.
- Beide Monate Montag–Sonntag mit vollständigen Kalenderwochen nebeneinander darstellen. Tage ausserhalb des jeweiligen Monats werden zurückhaltend gezeigt.
- Alle Ereignisse eines Tages im Druck ausgeben; keine interaktiven „+N weitere“-Zusammenfassungen verwenden.
- Ereignisse auf Titel, kurze Uhrzeit und vorhandene Statusmarkierung beschränken. Bestätigte, provisorische, Ideen und abgesagte Einträge bleiben durch Linie, Füllung und Symbol auch in Graustufen unterscheidbar.
- Einen kleinen Druckkopf mit Monatsbereich und Erstellungsdatum ergänzen.
- Druck-CSS für A3 quer, sparsame Seitenränder, zwei gleich breite Monatsspalten und drucksichere Typografie ergänzen. Bei hoher Belegung darf der Inhalt auf weitere Seiten fliessen, statt abgeschnitten zu werden.
- Navigation, Filter, Schaltflächen, Seitenleiste, Dialoge und übrige Anwendungsoberfläche im Druck vollständig ausblenden.

## Technische Details
- Neue kleine Präsentationskomponente für die Druckmonate; sie erhält `filteredEvents`, Kalenderjahr/-monat sowie bestehende Kategorie- und Bereichszuordnungen.
- Die Aktion erscheint nur in der Monatsansicht und ruft `window.print()` auf.
- Print-Regeln bleiben auf klar benannte Druckklassen und `@media print` / `@page { size: A3 landscape; }` begrenzt.
- Keine Datenbank-, Berechtigungs-, API-, PDF- oder Backend-Änderungen.

## Prüfung
- November 2026 zeigt November + Dezember 2026.
- Dezember 2026 zeigt Dezember 2026 + Januar 2027.
- Ein aktiver Planungsbereich-Filter gilt identisch für beide Monate.
- Mehrere Ereignisse an einem Tag erscheinen vollständig und ohne „+N weitere“.
- Druckvorschau ist A3 quer, enthält keine Anwendungsbedienung und bleibt ohne Hintergrundgrafiken anhand von Rahmen, Statussymbolen und Linien verständlich.
- Bildschirmansicht bleibt unverändert.
