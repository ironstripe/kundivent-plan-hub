# Mobile: Eintrags-Vorschau (Hover) funktioniert nicht

## Diagnose (bestätigt im Code)

In `src/components/kundivent/month-calendar.tsx` ist die Vorschau eines Eintrags als Radix `HoverCard` umgesetzt (Zeile 458). Zwei Gründe, warum auf dem Handy nichts erscheint:

1. **Hover existiert auf Touch-Geräten nicht** — eine HoverCard öffnet sich nur bei Maus-Hover.
2. Der Vorschau-Inhalt ist zusätzlich explizit unter 768px ausgeblendet: `HoverCardContent className="hidden w-72 p-3 md:block"` (Zeile 488).

Auf Mobile öffnet ein Tippen auf einen Eintrag daher direkt den Event-Drawer; die Vorschau (Status, Kategorie, Personen, Bereiche, Verantwortlich, Ersteller) ist dort nie sichtbar. Alle anderen Hover-Effekte in der App (Listen, Matrix, Freie Termine) sind rein kosmetisch — Klicks/Taps funktionieren dort.

## Fix

**Ziel:** Auf Touch-Geräten zeigt der erste Tap die Vorschau, ein Button darin öffnet den Drawer. Desktop bleibt unverändert (Hover-Vorschau + Klick öffnet Drawer).

### Änderungen in `src/components/kundivent/month-calendar.tsx`

1. **Vorschau-Inhalt auslagern:** Der Inhalt von `HoverCardContent` (Titel, Datum/Zeit, Status-/Kategorie-/Pax-Badges, Bereiche, Verantwortlich, Erstellt-von) wird in eine lokale Komponente `EventPreview` extrahiert, damit er in beiden Varianten wiederverwendet wird.
2. **Geräteunterscheidung:** Mit dem vorhandenen `useIsMobile()`-Hook (`src/hooks/use-mobile.tsx`):
   - **Desktop (≥768px):** bisherige `HoverCard` unverändert (Hover öffnet Vorschau, Klick öffnet Drawer).
   - **Mobile (<768px):** stattdessen ein `Popover` (`@/components/ui/popover`). Erster Tap auf den Event-Balken öffnet das Popover mit `EventPreview` plus einem Button „Details öffnen", der `onOpenEvent(event)` aufruft. Tippen ausserhalb schliesst das Popover. Das Popover ist bewusst nicht `hidden` auf Mobile (behebt auch die `md:block`-Sperre).

### Nicht geändert

- Desktop-Verhalten, Drawer, Einträge-/Matrix-Ansichten, Datenlogik.

## Verifikation

- Typecheck.
- Playwright im Mobile-Viewport: Tap auf Event-Balken zeigt Vorschau-Popover; „Details öffnen" öffnet den Drawer; Tap daneben schliesst.
- Desktop-Viewport: Hover-Vorschau und Klick-Verhalten wie bisher.
