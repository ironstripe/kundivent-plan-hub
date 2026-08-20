# Kundivent — Build 01: Foundation & Database

Scope: technical + visual foundation only. No event planning functionality, no Timeline/Matrix, no migration.

## 1. Backend (Lovable Cloud)

Enable Lovable Cloud (Postgres + auth) and create the schema in one migration:

- `planning_areas` — id, name, active, sort_order, timestamps
- `categories` — id, name, color, active, sort_order, timestamps
- `events` — id, title, category_id (FK), start_date, end_date, all_day, start_time, end_time, status, pax, notes, external_source/external_id/sync_status/last_synced_at, migration_source/migration_source_ref/migration_review_required, timestamps. Status enforced via a Postgres enum (`idea`, `provisional`, `confirmed`, `cancelled`).
- `event_planning_areas` — id, event_id (FK, cascade delete), planning_area_id (FK, restrict), unique on (event_id, planning_area_id)

Quality: indexes on `events.start_date`, `events.category_id`, and both FK columns of the join table; `now()` defaults; shared `updated_at` trigger; RLS enabled on all four tables with a single policy set — any authenticated user may read/write; no anon access; no role model.

Seed data in the same migration:
- Planning areas in order: Hofladen, KFH-Fishing, Restaurant / À la Carte, Event / Pavillon, Hofstube, Terrasse (no "Kundelfingerhof AG").
- The nine categories from the PRD with restrained, distinguishable colours (muted slate/teal/amber/rose family, no neon).
- No seeded events.

## 2. Authentication

Minimal email + password sign-in/sign-up on a public `/auth` route in the Kundivent visual language. All app routes live behind the authenticated gate; unauthenticated visits redirect to `/auth`. Header shows the signed-in email and a sign-out action. No user admin, roles, or password-management UI.

## 3. App shell & routes

Persistent shell: compact top bar with the Kundivent wordmark, primary nav, and account menu; collapses to a mobile sheet menu. Navigation contains exactly:

- Übersicht (`/`)
- Freie Termine (`/freie-termine`)
- Einträge (`/eintraege`)
- Einstellungen (`/einstellungen`)

Freie Termine and Einträge are quiet empty-state pages stating the functionality follows in a later build phase.

### Übersicht placeholder

Header "Eventplanung" plus a single compact control bar (structural only, non-functional): year navigation (‹ 2026 ›), planning-area / category / status filter dropdowns, a Timeline | Matrix segmented switch, and a primary `+ Eintrag` button. Below it, a bordered content region with a note that the planning views arrive in Phase 02.

### Einstellungen

Two dense tables reading live from the database via TanStack Query: planning areas (order, name, status badge) and categories (colour swatch + name, order, status badge). Read-only in this phase.

## 4. Design system

Yeti Alpine Booking–style operational UI: neutral slate surfaces with one restrained accent, small type scale, tight spacing, thin borders instead of shadows, compact tables, subtle hover/selected states. shadcn/ui components (button, dropdown, badge, card, table, sheet, input, tabs) with all colours as semantic tokens in `src/styles.css` — light and dark. No KPI tiles, gradients, hero sections, or illustrations. Colour is never the sole carrier of meaning: status and active flags always carry a text label.

Responsive: desktop-first density, tablet keeps the shell, mobile uses the sheet nav and lets wide future tables scroll horizontally.

## 5. Data access

Server functions for reads (planning areas, categories) plus typed TanStack Query hooks `usePlanningAreas()` / `useCategories()` in `src/lib/`. One thin pattern, ready for an `events` hook in Phase 02 — no extra abstraction layers.

## Technical notes

- TanStack Start file routes; protected pages under `src/routes/_authenticated/`, index at `/` redirect-free by keeping the public landing behaviour minimal (root route redirects signed-out users to `/auth`).
- Per-route `head()` metadata with German titles/descriptions.
- No mock data anywhere; Settings proves the live database connection.

Stops here — Phase 02 (Event CRUD) is not started.
