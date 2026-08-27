// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        strategies: "generateSW",
        registerType: "prompt",
        injectRegister: null,
        devOptions: { enabled: false },
        filename: "sw.js",
        outDir: "dist/client",
        manifest: false,
        includeAssets: [],
        workbox: {
          globDirectory: "dist/client",
          globPatterns: ["**/*.{js,css,woff,woff2}", "icon-*.png", "apple-touch-icon.png"],
          globIgnores: ["**/node_modules/**/*", "sw.js", "workbox-*.js"],
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          clientsClaim: false,
          skipWaiting: false,
          navigationPreload: true,
          runtimeCaching: [
            {
              // HTML navigations: always try the network first so operational
              // data is never served from a stale shell without notice.
              urlPattern: ({ request, url }: { request: Request; url: URL }) =>
                request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
              handler: "NetworkFirst",
              options: {
                cacheName: "kundivent-html",
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              // Same-origin hashed build assets only.
              urlPattern: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
                sameOrigin && /\/_build\/|\.(?:js|css|woff2?|png|svg|ico)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "kundivent-assets",
                expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  },
});
