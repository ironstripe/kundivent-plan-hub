# Kundivent Planner

Kundivent – Build 01: Foundation & Database

CONTEXT

Use the Kundivent PRD v1.0 stored in Project Knowledge as the authoritative source of truth for all product, business, UX and architecture decisions.

The existing Yeti Alpine Booking application is the visual and UX reference:

https://github.com/ironstripe/yeti-alpine-booking

Kundivent should feel visually like a sibling of Yeti Alpine Booking, especially its Scheduler, but must not inherit ski-school-specific functionality.

This is Build Phase 01 only.

Do not implement later phases yet.

OBJECTIVE

Create the technical and visual foundation for Kundivent.

At the end of this phase we need:

working Supabase database structure

initial master data

simple authentication

application shell and navigation

Yeti-inspired base design

clean technical foundation for Event CRUD in Phase 02

Do not build the actual event planning functionality yet.

1. SUPABASE

Connect the project to Supabase and use Supabase PostgreSQL as the persistent database.

Do not use mock data or local-only storage for application data.

Create the database schema defined in the Kundivent PRD.

Table: planning_areas

Fields:

id UUID primary key

name

active

sort_order

created_at

updated_at

Seed these planning areas in this exact initial order:

Hofladen

KFH-Fishing

Restaurant / À la Carte

Event / Pavillon

Hofstube

Terrasse

Kundelfingerhof AG must not be created as a planning area. It is the organisational umbrella.

Table: categories

Fields:

id UUID primary key

name

color

active

sort_order

created_at

updated_at

Seed these initial categories:

Hochzeit / Bankett

Eigenveranstaltung

Gastroaktion

Kurs

Messe / externer Auftritt

Promotion / Verkauf

Betriebsferien

Interner Anlass

Sonstiges

Assign restrained, clearly distinguishable colours that fit the Yeti-inspired visual system.

Colours must not be the only way status or category information can later be understood.

Table: events

Create the structure now, but do not build the Event CRUD UI in this phase.

Fields:

id UUID primary key

title

category_id foreign key

start_date

end_date nullable

all_day

start_time nullable

end_time nullable

status

pax nullable

notes nullable

Future integration fields:

external_source nullable

external_id nullable

sync_status nullable

last_synced_at nullable

Migration fields:

migration_source nullable

migration_source_ref nullable

migration_review_required boolean default false

System fields:

created_at

updated_at

Supported status values:

idea

provisional

confirmed

cancelled

Use an appropriate database constraint or enum strategy to prevent invalid status values.

Table: event_planning_areas

Fields:

id UUID primary key

event_id foreign key

planning_area_id foreign key

Add a unique constraint for:

event_id + planning_area_id

Configure appropriate foreign-key behaviour.

An event must later be able to belong to multiple planning areas.

Do not model this using fields such as planning_area_1, planning_area_2, etc.

2. DATABASE QUALITY

Create appropriate:

foreign keys

indexes

timestamp defaults

updated-at handling

basic Row Level Security appropriate for authenticated users

The schema should be simple and maintainable.

Do not introduce additional domain tables unless technically required.

In particular, do not create:

rooms

locations

reservations

customers

resources

tasks

suppliers

Gastronovi tables

3. AUTHENTICATION

Implement simple Supabase authentication.

There is no role or permission model in Kundivent MVP.

All authenticated users have the same application permissions.

Create a simple login experience consistent with the Yeti visual language.

Do not build:

user administration

role switching

permission settings

onboarding workflows

complex password-management UI

Keep authentication minimal.

4. APPLICATION SHELL

Create the basic Kundivent application shell.

Primary navigation must contain exactly:

Übersicht

Freie Termine

Einträge

Einstellungen

Do not add additional navigation modules.

Use temporary empty-state pages for these four routes.

The pages should clearly indicate that the respective functionality will be implemented in later phases.

5. ÜBERSICHT PLACEHOLDER

Create the structural shell for the future main planning screen.

Header:

Eventplanung

Provide structural placeholders for:

year navigation

planning-area filter

category filter

status filter

view switch Timeline | Matrix

+ Eintrag primary action

These controls do not need their final functionality yet.

Do not build the Timeline or Matrix in this phase.

The goal is to establish layout and visual hierarchy only.

6. DESIGN SYSTEM

Use the existing Yeti Alpine Booking application as the primary design reference.

Reference repository:

https://github.com/ironstripe/yeti-alpine-booking

Focus particularly on its Scheduler and overall application shell.

Reuse its design principles:

typography

spacing

navigation structure

header hierarchy

restrained colour palette

buttons

dropdowns

badges

cards

tables

dialogs/drawers

hover states

selected states

compact information density

responsive behaviour

Use:

React

TypeScript

Tailwind CSS

shadcn/ui

Where suitable, follow established component patterns from Yeti rather than inventing a completely different design system.

Kundivent should feel like another application from the same product family.

Do not copy ski-school-specific UI or terminology.

7. VISUAL CHARACTER

The interface should feel:

calm

professional

operational

compact

highly readable

modern but not decorative

Prioritise information density over large decorative components.

Avoid:

oversized cards

dashboard KPI tiles

unnecessary gradients

excessive shadows

excessive whitespace

marketing-style layouts

decorative illustrations

This is an operational planning application.

8. RESPONSIVE FOUNDATION

Prepare the application shell for:

Desktop as primary environment

Tablet

Mobile

The future Matrix will require horizontal scrolling on smaller screens.

Do not attempt to squeeze all future planning columns into a mobile viewport.

9. SETTINGS PLACEHOLDER

The Settings page may already display the seeded:

planning areas

categories

This is useful for validating the database connection.

For this phase, displaying the records is sufficient.

Full create/edit/deactivate functionality belongs to a later phase.

The data shown here must come from Supabase, not hardcoded frontend arrays.

10. DATA ACCESS

Establish a clean reusable data-access pattern for Supabase.

Prefer TanStack Query for server-state handling.

Create reusable hooks/services where appropriate for:

planning areas

categories

later events

Do not over-engineer an unnecessary abstraction layer.

DO NOT IMPLEMENT IN THIS PHASE

Do not implement:

Event CRUD UI

Excel migration

Timeline

Matrix

availability calculations

Freie Termine functionality

event search

event filtering logic

operating-holiday workflows

Gastronovi integration

room management

resource management

drag and drop

notifications

reporting

analytics

role-based permissions

Do not introduce functionality that is not defined in the Kundivent PRD.

IMPORTANT IMPLEMENTATION RULES

Treat the Kundivent PRD v1.0 as the source of truth.

Preserve the database structure defined in the PRD.

Use real Supabase persistence from the beginning.

Do not use mock events to simulate later functionality.

Do not redesign or expand the product scope.

Do not modify unrelated functionality once implemented.

Keep components modular enough for later Timeline and Matrix implementation.

Prefer simple solutions over premature abstraction.

Do not implement Gastronovi yet.

Do not create a separate Room/Location model.

ACCEPTANCE CRITERIA

Build 01 is complete only when:

Supabase is connected.

planning_areas exists.

categories exists.

events exists.

event_planning_areas exists.

Required foreign keys and constraints exist.

Initial planning areas are seeded correctly.

Initial categories are seeded correctly.

Kundelfingerhof AG is not stored as a planning area.

Planning areas and categories can be read from Supabase.

Authentication works.

Unauthenticated users cannot access the application.

Authenticated users can access the application.

No role-based permission system has been introduced.

Main navigation contains only Übersicht, Freie Termine, Einträge and Einstellungen.

Übersicht has the structural planning header defined above.

Settings can display real planning areas and categories from Supabase.

The visual design clearly follows the Yeti Alpine Booking design language.

The application works after browser reload.

The foundation is responsive.

No mock event system has been created.

No functionality belonging to later build phases has been unnecessarily implemented.

FINAL CHECK

After implementation, review the result against the Kundivent PRD v1.0.

Before finishing, verify specifically:

database schema compliance

correct seed data

authentication

navigation

Supabase persistence

Yeti design consistency

responsive foundation

absence of out-of-scope features

Do not start Phase 02 automatically.

Stop after Build 01 is complete.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://kundivent-plan-hub.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/698de5b8-4a93-47e4-a897-e8b42c9a8798).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
