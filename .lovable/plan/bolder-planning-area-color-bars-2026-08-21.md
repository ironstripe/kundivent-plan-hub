# Bolder planning-area color bars

## Goal
Make the planning-area color bars in the calendar views more prominent and easier to scan at a glance, without changing the underlying visual system (area = primary color, status = secondary treatment).

## Selected direction
**High-impact saturated indicators**
- Thicker full-height color strip on the left of each event bar.
- Slightly taller event bars.
- Stronger, more saturated background fill.
- Status marker kept as a small non-color indicator.

## Scope
- Primary: `src/components/kundivent/month-calendar.tsx`
- Secondary: `src/components/kundivent/matrix-view.tsx` and `src/components/kundivent/timeline-event-row.tsx`
- Supporting: `src/lib/area-theme.ts` for shared class/variable tweaks.

## Plan

1. **Increase the left color accent**
   - Change `eventBlockClasses` in `src/lib/area-theme.ts` from `border-l-[3px]` to a thicker left border (e.g. `border-l-[6px]` or `border-l-[8px]`) so the planning-area color is immediately visible.
   - Keep the accent color tied to `var(--ev-accent)` and derived from `AREA_STYLE`.

2. **Slightly enlarge the bars**
   - Raise `LANE_HEIGHT` in `MonthCalendar` from `20` to `24` so bars are ~21 px tall.
   - Apply the same height bump to Matrix and Timeline event rows where bars are rendered.

3. **Strengthen background fill and border**
   - Keep `bg-[var(--ev-bg)]` for confirmed, but consider a slightly more saturated fallback for light mode.
   - Add a subtle 1 px border around the bar in the planning-area color to make the edge crisper (provisional stays dashed, confirmed stays solid, idea stays dotted, cancelled stays muted).

4. **Keep status distinction**
   - Retain the `statusMark` indicator in front of the title.
   - Keep confirmed/provisional/idea/cancelled treatments exactly as defined in the design system.

5. **Apply consistently across views**
   - Use the same `eventBlockClasses` helper in Matrix and Timeline so all event bars look the same.
   - Ensure hover states remain smooth and non-jarring.

6. **Verify**
   - Check the monthly calendar with multiple overlapping events and multi-day spans.
   - Check the Matrix view for identical color-bar treatment.
   - Check the Timeline view (now in Einträge) for the same bar height and accent.

## Constraints
- No database or business logic changes.
- No new color system; only adjust the existing planning-area tokens.
- Keep the calendar compact: 3-lane layout must still fit within the current day cell height.
