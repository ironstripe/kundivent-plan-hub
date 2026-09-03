import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MonthCalendar } from "@/components/kundivent/month-calendar";
import type { EventWithRelations } from "@/lib/events";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/** Months rendered around the active month before lazy extension kicks in. */
const WINDOW_BEFORE = 2;
const WINDOW_AFTER = 2;
/** Extension step and hard cap so the DOM cannot grow without bound. */
const EXTEND_BY = 2;
const MAX_MONTHS = 25;
/** Distance (px) from the loaded edge that triggers loading more months. */
const EXTEND_THRESHOLD = 900;

export type ScrollTarget = {
  year: number;
  month: number;
  /** Optional ISO date to bring into view inside the month. */
  date?: string;
  nonce: number;
};

const key = (year: number, month: number) => year * 12 + month;
const fromKey = (k: number) => ({ year: Math.floor(k / 12), month: ((k % 12) + 12) % 12 });

/**
 * Continuous month calendar: renders a window of months stacked vertically,
 * extends it lazily in both directions and reports the month currently in
 * focus so the toolbar stays in sync with what is on screen.
 */
export function MonthScroller({
  year,
  month,
  events,
  today,
  categoryById,
  areaNameById,
  target,
  onActiveMonthChange,
  onOpenEvent,
  onCreate,
  /** Sticky offset (px) of the app header + toolbar above the calendar. */
  headerOffset = 112,
}: {
  year: number;
  month: number;
  events: EventWithRelations[];
  today: string;
  categoryById: Map<string, { name: string; color: string }>;
  areaNameById: Map<string, string>;
  target: ScrollTarget | null;
  onActiveMonthChange: (year: number, month: number) => void;
  onOpenEvent: (event: EventWithRelations) => void;
  onCreate: (date: string) => void;
  headerOffset?: number;
}) {
  const initial = key(year, month);
  const [range, setRange] = useState({
    start: initial - WINDOW_BEFORE,
    end: initial + WINDOW_AFTER,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const monthRefs = useRef(new Map<number, HTMLDivElement>());
  const pendingPrepend = useRef(false);
  const heightBeforePrepend = useRef(0);
  const pendingTarget = useRef<number | null>(null);
  const activeKey = useRef(initial);
  const lastNonce = useRef<number | null>(null);

  const setMonthRef = useCallback((k: number, node: HTMLDivElement | null) => {
    if (node) monthRefs.current.set(k, node);
    else monthRefs.current.delete(k);
  }, []);

  /** Scroll a month (optionally a specific date) below the sticky header. */
  const scrollToKey = useCallback(
    (k: number, date?: string) => {
      const node = monthRefs.current.get(k);
      if (!node) return false;
      const dateNode = date
        ? (node.querySelector(`[data-date="${date}"]`) as HTMLElement | null)
        : null;
      const el = dateNode ?? node;
      const top = window.scrollY + el.getBoundingClientRect().top - headerOffset - 8;
      window.scrollTo({ top: Math.max(0, top) });
      return true;
    },
    [headerOffset],
  );

  // Navigation (arrows, month picker, Heute, global search) scrolls instead of
  // swapping the view; extend the window first when the target is outside it.
  useEffect(() => {
    if (!target || lastNonce.current === target.nonce) return;
    lastNonce.current = target.nonce;
    const k = key(target.year, target.month);
    activeKey.current = k;
    pendingTarget.current = k;
    setRange((prev) => {
      if (k >= prev.start && k <= prev.end) return prev;
      return { start: k - WINDOW_BEFORE, end: k + WINDOW_AFTER };
    });
    // Run after the (possibly new) months are laid out.
    requestAnimationFrame(() => {
      scrollToKey(k, target.date);
      requestAnimationFrame(() => {
        scrollToKey(k, target.date);
        pendingTarget.current = null;
      });
    });
  }, [target, scrollToKey]);

  // Keep the visual position stable when months are inserted above.
  useLayoutEffect(() => {
    console.log("[scroller] layout", range.start, pendingPrepend.current);
    if (!pendingPrepend.current) return;
    pendingPrepend.current = false;
    const delta = document.documentElement.scrollHeight - heightBeforePrepend.current;
    console.log("[scroller] prepend delta", delta, "scrollY", window.scrollY);
    if (delta) window.scrollBy(0, delta);
  }, [range.start]);

  // Active month detection + lazy extension, throttled per animation frame.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const container = containerRef.current;
      if (!container) return;
      const line = headerOffset + 24;

      let visible: number | null = null;
      for (const [k, node] of monthRefs.current) {
        const rect = node.getBoundingClientRect();
        if (rect.top - line <= 0 && rect.bottom - line > 0) visible = k;
      }
      if (visible === null) {
        // Above the first month (or between): fall back to the nearest month.
        let best: number | null = null;
        let bestDist = Infinity;
        for (const [k, node] of monthRefs.current) {
          const dist = Math.abs(node.getBoundingClientRect().top - line);
          if (dist < bestDist) {
            bestDist = dist;
            best = k;
          }
        }
        visible = best;
      }

      if (visible !== null && pendingTarget.current === null && visible !== activeKey.current) {
        activeKey.current = visible;
        const { year: y, month: m } = fromKey(visible);
        onActiveMonthChange(y, m);
      }

      const rect = container.getBoundingClientRect();
      const size = range.end - range.start + 1;
      if (!pendingPrepend.current && rect.top > -EXTEND_THRESHOLD && size < MAX_MONTHS) {
        console.log("[scroller] prepend requested");
        pendingPrepend.current = true;
        heightBeforePrepend.current = document.documentElement.scrollHeight;
        setRange((prev) => ({ ...prev, start: prev.start - EXTEND_BY }));
      }
      if (rect.bottom - window.innerHeight < EXTEND_THRESHOLD && size < MAX_MONTHS) {
        setRange((prev) =>
          prev.end - prev.start + 1 >= MAX_MONTHS ? prev : { ...prev, end: prev.end + EXTEND_BY },
        );
      }
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [headerOffset, onActiveMonthChange, range.start, range.end]);

  // Land on the requested month on first render.
  useEffect(() => {
    requestAnimationFrame(() => scrollToKey(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const months: number[] = [];
  for (let k = range.start; k <= range.end; k += 1) months.push(k);

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-md border border-border bg-card"
    >
      <div
        className="sticky z-10 grid grid-cols-7 border-b border-border bg-muted/95 backdrop-blur"
        style={{ top: headerOffset }}
      >
        {WEEKDAYS.map((d, i) => (
          <div
            key={d}
            className={cn(
              "px-2 py-1.5 text-[11px] uppercase tracking-wider",
              i >= 4 ? "font-semibold text-foreground" : "font-medium text-muted-foreground",
              i > 0 && "border-l border-border/60",
            )}
          >
            {d}
          </div>
        ))}
      </div>

      {months.map((k) => {
        const { year: y, month: m } = fromKey(k);
        // Include neighbouring weeks so multi-day bars keep their context.
        const from = new Date(Date.UTC(y, m, 1) - 7 * 86400000).toISOString().slice(0, 10);
        const to = new Date(Date.UTC(y, m + 1, 0) + 7 * 86400000).toISOString().slice(0, 10);
        const monthEvents = events.filter((event) => {
          const end = event.end_date ?? event.start_date;
          return event.start_date <= to && end >= from;
        });
        return (
          <div key={k} ref={(node) => setMonthRef(k, node)}>
            <div className="flex items-center gap-2 border-b border-border bg-card px-2.5 py-1.5">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {MONTHS[m]} {y}
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <MonthCalendar
              year={y}
              month={m}
              events={monthEvents}
              today={today}
              categoryById={categoryById}
              areaNameById={areaNameById}
              onOpenEvent={onOpenEvent}
              onCreate={onCreate}
              hideWeekdayHeader
              bare
            />
          </div>
        );
      })}
    </div>
  );
}
