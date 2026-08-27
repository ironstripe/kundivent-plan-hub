# Build 13 – Kundivent als installierbare PWA

Ziel: Kundivent auf iOS, Android, Windows und macOS installierbar machen, ohne bestehende Funktionen, Design oder Datenlogik zu verändern.

## Was der Nutzer merkt

- Kundivent lässt sich über Chrome/Edge (Desktop, Android) installieren und auf iOS über „Zum Home-Bildschirm“ hinzufügen.
- Die installierte App startet ohne Browserleiste, mit Kundivent-Icon, -Name und -Farben.
- Login, Sessions, Kalender, Event-Drawer und Anhänge funktionieren unverändert.
- Ohne Internet erscheint ein dezenter Hinweis: „Keine Internetverbindung. Aktuelle Planungsdaten können momentan nicht geladen oder gespeichert werden.“ Speichern schlägt sichtbar fehl statt still zu tun, als hätte es geklappt.
- Bei einer neuen Version erscheint ein kleiner Hinweis „Eine neue Version von Kundivent ist verfügbar.“ mit Button „Aktualisieren“ – nie ein erzwungener Reload.
- Auf Smartphones mit Notch bleiben Kopfzeile und Buttons frei von der Systemleiste.

## Umfang

Enthalten: Manifest, Icons, Service Worker mit konservativem Caching, Offline-Hinweis, Verbindungsanzeige, Update-Hinweis, iOS-Metadaten, Safe-Area-Anpassungen, Prüfung von Auth/Routing/Anhängen im Standalone-Modus.

Nicht enthalten: Offline-Bearbeitung, Warteschlangen, Background-Sync, Konfliktauflösung, Push, native Apps, Kamera-Integration.

## Technische Umsetzung

1. **Icons**: Kundivent-Icon (Monogramm „K“ auf Markenfarbe, passend zur Kopfzeile) generieren; `public/` erhält 192×192, 512×512, maskable 512×512, `apple-touch-icon` 180×180 und Favicon-Varianten.
2. **Manifest**: `public/manifest.webmanifest` mit name/short_name „Kundivent“, `start_url: "/"`, `scope: "/"`, `display: standalone`, `theme_color`/`background_color` aus den bestehenden Design-Tokens, `lang: de-CH`, Icon-Einträge inkl. maskable. Keine Orientierungssperre.
3. **Head-Tags** in `src/routes/__root.tsx`: `manifest`, `theme-color`, `apple-touch-icon`, `apple-mobile-web-app-capable`/`-status-bar-style`, `viewport` mit `viewport-fit=cover`.
4. **Service Worker**: `vite-plugin-pwa` mit `generateSW`, `registerType: "autoUpdate"`, `devOptions.enabled: false`, `injectRegister: null`. Registrierung ausschliesslich über ein Wrapper-Modul, das in Dev, im iframe, in Lovable-Preview-Hosts und bei `?sw=off` nicht registriert und dort bestehende Registrierungen entfernt.
5. **Cache-Strategie**: `CacheFirst` nur für gehashte statische Assets und Icons; HTML-Navigationen `NetworkFirst`; Supabase-REST-, Auth- und Storage-Aufrufe explizit vom Caching ausgenommen; `/~oauth` aus dem Navigation-Fallback ausgeschlossen.
6. **Verbindungsstatus**: kleiner Hook (`online`/`offline` Events + Reconnect-Erkennung) und ein dezentes Banner/Toast in der App-Shell – nur sichtbar bei Offline, Wiederverbindung und kurzer Bestätigung danach.
7. **Schreibschutz offline**: zentrale Mutationen (Events, Benutzer, Anhänge) prüfen `navigator.onLine` und melden per Fehler-Toast, dass nicht gespeichert werden kann; Speichern-Buttons werden offline deaktiviert.
8. **Update-Fluss**: Der Wrapper meldet „waiting worker“ an einen Update-Toast mit Aktion „Aktualisieren“. Solange der Event-Drawer geöffnete, ungespeicherte Änderungen hat, wird der Hinweis zurückgestellt statt aktiviert.
9. **Safe Areas**: `env(safe-area-inset-*)` für Header, Sheet-Footer und Hauptcontainer in `app-shell.tsx`/`styles.css`; auf Desktop keine zusätzliche Polsterung.
10. **Verifikation**: Produktionsbuild mit Playwright prüfen – Manifest-Parsing, SW-Registrierung, Standalone-Rendering, Deep-Link-Reload (`/eintraege`, `/einstellungen`), Login/Session, Offline-Verhalten und Anhang-Upload.

Bestehende Datenbank-, RLS- und Geschäftslogik bleiben unverändert.
