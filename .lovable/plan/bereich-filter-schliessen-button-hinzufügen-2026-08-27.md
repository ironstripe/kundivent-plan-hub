# Bereich-Filter: Schliessen-Button hinzufügen

## Ziel
Der Bereichs-Filter-Popover ("Alle Bereiche" / "2 Bereiche") soll einen klar erkennbaren Schliessen-Button erhalten, damit Tester die Auswahl aktiv bestätigen und das Dropdown schliessen können.

## Vorschlag
- Das Popover wird gesteuert (`open` / `onOpenChange`), damit ein Button es explizit schliessen kann.
- Unter der Checkbox-Liste wird ein Footer eingefügt mit:
  - Linksbündig: "Alle Bereiche" / "Alle auswählen" als Text-Button (optional, falls nicht schon oben vorhanden).
  - Rechtsbündig: Primärer Button **"Fertig"** (oder "OK" / "Schliessen").
- Klick auf "Fertig" schliesst das Popover sofort.
- Klick ausserhalb oder auf eine Auswahl bleibt wie heute möglich.

## Umsetzung
1. In `src/routes/_authenticated/index.tsx`:
   - State `areaPopoverOpen` hinzufügen.
   - Bereichs-`<Popover>` auf `open={areaPopoverOpen}` und `onOpenChange={setAreaPopoverOpen}` umstellen.
   - In `<PopoverContent>` am Ende einen Footer-Bereich mit dem Button "Fertig" einfügen, der `setAreaPopoverOpen(false)` aufruft.
2. Visuelles Styling an shadcn-Standard anpassen: `border-t border-border pt-2 mt-1` und `flex justify-end`.

## Abgrenzung
- Keine Änderung an der Filterlogik oder an anderen Popovers (z. B. Monat/Jahr-Picker).
- Keine Änderung am sekundären Filter-Popover.
