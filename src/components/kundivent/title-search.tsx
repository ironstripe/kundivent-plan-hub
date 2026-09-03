import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type TitleSearchResult = {
  id: string;
  title: string;
  /** Preformatted date label, e.g. "14.11.2026". */
  dateLabel: string;
  /** Optional context line: planning areas / category. */
  meta?: string;
};

/** Compact toolbar search for event titles (Monat, Jahr, Matrix), global result list. */
export function TitleSearch({
  value,
  onChange,
  results,
  loading,
  onSelect,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  results?: TitleSearchResult[];
  loading?: boolean;
  onSelect?: (id: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const active = value.trim().length >= 2;
  const showList = open && active && Boolean(onSelect);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        aria-label="Suchen"
        placeholder="Suchen"
        maxLength={100}
        className={cn(
          "h-8 w-40 pl-7 pr-7 text-xs [&::-webkit-search-cancel-button]:hidden",
          value.trim() && "border-primary/50 bg-primary/5",
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
          aria-label="Suche leeren"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      ) : null}

      {showList ? (
        <div className="absolute right-0 z-50 mt-1 w-72 overflow-hidden rounded-md border border-border bg-popover shadow-md">
          {loading ? (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">Suche läuft …</p>
          ) : (results?.length ?? 0) === 0 ? (
            <p className="px-2.5 py-2 text-xs text-muted-foreground">Keine Treffer</p>
          ) : (
            <ul className="max-h-72 overflow-y-auto py-1">
              {results!.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect?.(r.id);
                      setOpen(false);
                    }}
                    className="block w-full px-2.5 py-1.5 text-left hover:bg-accent"
                  >
                    <span className="block truncate text-xs font-medium">{r.title}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {r.dateLabel}
                      {r.meta ? ` · ${r.meta}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
