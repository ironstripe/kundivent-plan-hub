import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { YearOverview } from "@/components/kundivent/year-overview";
import type { EventWithRelations } from "@/lib/events";
import type { ScrollTarget } from "@/components/kundivent/month-scroller";

/** Years rendered around the active year before lazy extension kicks in. */
const WINDOW_BEFORE = 1;
const WINDOW_AFTER = 1;
const EXTEND_BY = 1;
/** Sliding window size: keeps DOM bounded while any year stays reachable. */
const MAX_YEARS = 7;
/** Distance (px) from the loaded edge that triggers loading more years. */
const EXTEND_THRESHOLD = 900;

/**
 * Continuous year overview: stacks year grids vertically, extends the window
 * lazily in both directions and reports the year currently in focus so the
 * toolbar and URL stay in sync with what is on screen.
 */
export function YearScroller({
  year,
  events,
  today,
  categoryById,
  areaNameById,
  target,
  onActiveYearChange,
  onOpenEvent,
  onOpenMonth,
  headerOffset = 112,
}: {
  year: number;
  events: EventWithRelations[];
  today: string;
  categoryById: Map<string, { name: string; color: string }>;
  areaNameById: Map<string, string>;
  target: ScrollTarget | null;
  onActiveYearChange: (year: number) => void;
  onOpenEvent: (event: EventWithRelations) => void;
  onOpenMonth: (year: number, month: number) => void;
  headerOffset?: number;
}) {
  const [range, setRange] = useState({
    start: year - WINDOW_BEFORE,
    end: year + WINDOW_AFTER,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const yearRefs = useRef(new Map<number, HTMLDivElement>());
  const pendingShift = useRef(false);
  const anchorYear = useRef(year);
  const anchorTop = useRef(0);
  const pendingTarget = useRef<number | null>(null);
  const activeYear = useRef(year);
  const lastNonce = useRef<number | null>(null);

  const setYearRef = useCallback((y: number, node: HTMLDivElement | null) => {
    if (node) yearRefs.current.set(y, node);
    else yearRefs.current.delete(y);
  }, []);

  /** Scroll a year (optionally a specific date) below the sticky header. */
  const scrollToYear = useCallback(
    (y: number, date?: string) => {
      const node = yearRefs.current.get(y);
      if (!node) return false;
      const dateNode = date
        ? (node.querySelector(`[data-year-month="${date.slice(0, 7)}"]`) as HTMLElement | null)
        : null;
      const el = dateNode ?? node;
      const top = window.scrollY + el.getBoundingClientRect().top - headerOffset - 8;
      window.scrollTo({ top: Math.max(0, top) });
      return true;
    },
    [headerOffset],
  );

  // Navigation (arrows, picker, Heute, global search) scrolls instead of
  // swapping the view; extend the window first when the target is outside it.
  useEffect(() => {
    if (!target || lastNonce.current === target.nonce) return;
    lastNonce.current = target.nonce;
    const y = target.year;
    activeYear.current = y;
    pendingTarget.current = y;
    setRange((prev) => {
      if (y >= prev.start && y <= prev.end) return prev;
      return { start: y - WINDOW_BEFORE, end: y + WINDOW_AFTER };
    });
    requestAnimationFrame(() => {
      scrollToYear(y, target.date);
      requestAnimationFrame(() => {
        scrollToYear(y, target.date);
        pendingTarget.current = null;
      });
    });
  }, [target, scrollToYear]);

  // Keep the visual position stable when height above the viewport changes.
  useLayoutEffect(() => {
    if (!pendingShift.current) return;
    const node = yearRefs.current.get(anchorYear.current);
    const delta = node ? node.getBoundingClientRect().top - anchorTop.current : 0;
    if (delta) window.scrollBy(0, delta);
    pendingShift.current = false;
    window.dispatchEvent(new Event("scroll"));
  }, [range.start, range.end]);

  // Active year detection + lazy extension, throttled per animation frame.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const container = containerRef.current;
      if (!container) return;
      const line = headerOffset + 24;

      let visible: number | null = null;
      for (const [y, node] of yearRefs.current) {
        const rect = node.getBoundingClientRect();
        if (rect.top - line <= 0 && rect.bottom - line > 0) visible = y;
      }
      if (visible === null) {
        let best: number | null = null;
        let bestDist = Infinity;
        for (const [y, node] of yearRefs.current) {
          const dist = Math.abs(node.getBoundingClientRect().top - line);
          if (dist < bestDist) {
            bestDist = dist;
            best = y;
          }
        }
        visible = best;
      }

      if (
        visible !== null &&
        pendingTarget.current === null &&
        !pendingShift.current &&
        visible !== activeYear.current
      ) {
        activeYear.current = visible;
        onActiveYearChange(visible);
      }

      const rect = container.getBoundingClientRect();
      const size = range.end - range.start + 1;
      if (!pendingShift.current && rect.top > -EXTEND_THRESHOLD) {
        const anchorNode = yearRefs.current.get(visible ?? range.start);
        if (!anchorNode) return;
        pendingShift.current = true;
        anchorYear.current = visible ?? range.start;
        anchorTop.current = anchorNode.getBoundingClientRect().top;
        setRange((prev) => ({
          start: prev.start - EXTEND_BY,
          end:
            prev.end - prev.start + 1 >= MAX_YEARS - EXTEND_BY ? prev.end - EXTEND_BY : prev.end,
        }));
      }
      if (rect.bottom - window.innerHeight < EXTEND_THRESHOLD) {
        if (size >= MAX_YEARS) {
          const anchorNode = yearRefs.current.get(visible ?? range.end);
          if (anchorNode && !pendingShift.current) {
            pendingShift.current = true;
            anchorYear.current = visible ?? range.end;
            anchorTop.current = anchorNode.getBoundingClientRect().top;
          }
          setRange((prev) => ({ start: prev.start + EXTEND_BY, end: prev.end + EXTEND_BY }));
        } else {
          setRange((prev) => ({ ...prev, end: prev.end + EXTEND_BY }));
        }
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
  }, [headerOffset, onActiveYearChange, range.start, range.end]);

  // Land on the requested year on first render.
  useEffect(() => {
    const initial = activeYear.current;
    requestAnimationFrame(() => scrollToYear(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const years: number[] = [];
  for (let y = range.start; y <= range.end; y += 1) years.push(y);

  return (
    <div ref={containerRef} className="space-y-3">
      {years.map((y) => (
        <div key={y} ref={(node) => setYearRef(y, node)} className="space-y-2">
          <div
            className="sticky z-[19] flex items-center gap-2 rounded-md border border-border bg-card/95 px-2.5 py-1.5 backdrop-blur"
            style={{ top: headerOffset }}
          >
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11px] font-semibold uppercase tracking-wider tabular-nums text-muted-foreground">
              {y}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <YearOverview
            year={y}
            events={events}
            today={today}
            categoryById={categoryById}
            areaNameById={areaNameById}
            onOpenEvent={onOpenEvent}
            onOpenMonth={(month) => onOpenMonth(y, month)}
            stickyOffset={headerOffset + 34}
          />
        </div>
      ))}
    </div>
  );
}
