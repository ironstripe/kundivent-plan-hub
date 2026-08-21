# Fix: "Neuer Eintrag" drawer cannot scroll

## Problem

The drawer's form is built as a three-part layout (header, scrollable body, sticky footer) using `flex-1` and `min-h-0` on the body. Those only work when the panel itself is a flex column. The sheet panel currently is not, so on short screens (like the current 890x495 viewport) the form grows past the panel and the lower fields plus the Speichern/Abbrechen buttons are unreachable — nothing scrolls.

## Fix

In `src/components/kundivent/event-drawer.tsx`, make the sheet panel a full-height flex column that clips overflow, so the middle section becomes the scroll container:

- add `flex flex-col overflow-hidden` to the existing `SheetContent` class list
- keep the header and footer fixed, body scrolls (`flex-1 min-h-0 overflow-y-auto` already present)
- add a little bottom padding to the scroll body so the last field isn't flush against the footer

No changes to the shared `ui/sheet.tsx` primitive, no logic or data changes.

## Verification

Open the drawer at a short viewport height and confirm the body scrolls and the Speichern button stays visible at the bottom.
