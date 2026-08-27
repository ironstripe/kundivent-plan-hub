import { useEffect, useRef, useState } from "react";
import { CloudOff, CloudUpload, RefreshCw, Wifi } from "lucide-react";
import { registerServiceWorker } from "@/lib/pwa";
import { hasUnsavedWork, useIsOnline } from "@/lib/connection";
import { useOfflineSync } from "@/lib/offline-sync";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Subtle connection banner + user-confirmed service-worker update prompt.
 * Renders nothing while online and up to date.
 */
export function PwaStatus() {
  const online = useIsOnline();
  const [reconnected, setReconnected] = useState(false);
  const [applyUpdate, setApplyUpdate] = useState<(() => void) | null>(null);
  const wasOffline = useRef(false);
  const { pending, syncing, retry, hasErrors } = useOfflineSync();

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      setReconnected(false);
      return;
    }
    if (!wasOffline.current) return;
    wasOffline.current = false;
    setReconnected(true);
    const timer = window.setTimeout(() => setReconnected(false), 4000);
    return () => window.clearTimeout(timer);
  }, [online]);

  useEffect(() => {
    void registerServiceWorker((apply) => setApplyUpdate(() => apply));
  }, []);

  if (!applyUpdate && online && !reconnected && pending.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      {!online ? (
        <Banner tone="warning" icon={<CloudOff className="size-4 shrink-0" />}>
          Keine Internetverbindung. Aktuelle Planungsdaten können momentan nicht geladen oder
          gespeichert werden.
        </Banner>
      ) : reconnected ? (
        <Banner tone="ok" icon={<Wifi className="size-4 shrink-0" />}>
          Verbindung wiederhergestellt.
        </Banner>
      ) : null}

      {applyUpdate ? (
        <Banner tone="info" icon={<RefreshCw className="size-4 shrink-0" />}>
          <span className="flex flex-wrap items-center gap-2">
            Eine neue Version von Kundivent ist verfügbar.
            <Button
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => {
                if (
                  hasUnsavedWork() &&
                  !window.confirm(
                    "Es gibt ungespeicherte Änderungen. Trotzdem aktualisieren? Nicht gespeicherte Eingaben gehen verloren.",
                  )
                ) {
                  return;
                }
                applyUpdate();
              }}
            >
              Aktualisieren
            </Button>
          </span>
        </Banner>
      ) : null}
    </div>
  );
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "warning" | "ok" | "info";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto flex max-w-md items-center gap-2 rounded-md border px-3 py-2 text-xs shadow-lg",
        tone === "warning" && "border-destructive/40 bg-destructive text-destructive-foreground",
        tone === "ok" && "border-border bg-card text-foreground",
        tone === "info" && "border-primary/40 bg-card text-foreground",
      )}
    >
      {icon}
      {children}
    </div>
  );
}
