# PWA-Icon auf iPhone in Logo-Grün ändern

Ziel: Das Home-Bildschirm-Icon auf iOS erscheint aktuell grau statt in der Kundivent-Markenfarbe (Primary-Grün/Petrol aus dem Header-Logo). Alle PWA-Icons sollen einheitlich diese Farbe als festen Hintergrund erhalten.

## Änderungen

1. **Icons neu generieren**
   - `public/apple-touch-icon.png` (180×180)
   - `public/icon-192.png`
   - `public/icon-512.png`
   - `public/icon-maskable-512.png`
   - `public/favicon-32.png`
   - Hintergrund: solide Primary-Farbe `#35687a` (entspricht `oklch(0.47 0.06 216)` / `bg-primary` im Header-Logo).
   - Vordergrund: weißes „K“-Monogramm, zentriert, ohne Transparenz.
   - Maskable-Variante mit ausreichendem Safe-Padding für iOS/Android-Maskierung.

2. **Manifest anpassen**
   - In `public/manifest.webmanifest` `background_color` und `theme_color` auf `#35687a` setzen, damit iOS/Safari keinen grauen Hintergrund hinzufügt.

3. **Verifikation**
   - Build läuft durch.
   - Icons werden im Preview unter `/apple-touch-icon.png`, `/icon-192.png` etc. mit der neuen Farbe ausgeliefert.
   - Keine weiteren Code-Änderungen nötig.
