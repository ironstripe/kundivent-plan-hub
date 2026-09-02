import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRadarSourceStatus, syncRadarSources } from "@/lib/radar.functions";
import { formatCreatedAt } from "@/lib/events";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  success: "Erfolgreich",
  failed: "Fehlgeschlagen",
  never: "Noch nie",
};

export function RadarAdmin() {
  const fetchStatus = useServerFn(getRadarSourceStatus);
  const runSync = useServerFn(syncRadarSources);
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);

  const sources = useQuery({
    queryKey: ["radar_sources_status"],
    queryFn: () => fetchStatus(),
  });

  const sync = useMutation({
    mutationFn: (sourceId?: string) => runSync({ data: sourceId ? { sourceId } : {} }),
    onSuccess: (result) => {
      const failed = result.results.filter((r) => r.status === "failed");
      const total = result.results.reduce((sum, r) => sum + r.count, 0);
      if (failed.length) {
        toast.warning(`${total} Einträge aktualisiert, ${failed.length} Quelle(n) fehlgeschlagen.`);
      } else {
        toast.success(`${total} Radar-Einträge aktualisiert.`);
      }
      void queryClient.invalidateQueries({ queryKey: ["radar_sources_status"] });
      void queryClient.invalidateQueries({ queryKey: ["radar_events"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Synchronisation fehlgeschlagen."),
    onSettled: () => setBusy(null),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Radar-Quellen</h2>
          <p className="text-xs text-muted-foreground">
            Externe Umfeld-Daten werden täglich automatisch abgeglichen. Bei einem Fehler bleiben
            die zuletzt geladenen Daten erhalten.
          </p>
        </div>
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          disabled={sync.isPending}
          onClick={() => {
            setBusy("all");
            sync.mutate(undefined);
          }}
        >
          <RefreshCw className={cn("size-3.5", sync.isPending && busy === "all" && "animate-spin")} />
          Alle synchronisieren
        </Button>
      </div>

      {sources.isPending ? (
        <p className="text-xs text-muted-foreground">Wird geladen…</p>
      ) : sources.error ? (
        <p className="text-xs text-destructive">
          {sources.error instanceof Error ? sources.error.message : "Fehler beim Laden."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Quelle</th>
                <th className="px-3 py-2 text-left font-medium">Einträge</th>
                <th className="px-3 py-2 text-left font-medium">Letzter Abgleich</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(sources.data ?? []).map((source) => (
                <tr key={source.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <p className="font-medium">{source.name}</p>
                    <p className="text-[11px] text-muted-foreground">{source.source_type}</p>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{source.entry_count}</td>
                  <td className="px-3 py-2">{formatCreatedAt(source.last_sync_at)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        source.last_sync_status === "failed" && "text-destructive",
                        source.last_sync_status === "success" && "text-foreground",
                        !source.last_sync_status && "text-muted-foreground",
                      )}
                    >
                      {STATUS_LABEL[source.last_sync_status ?? "never"] ?? source.last_sync_status}
                    </span>
                    {source.last_sync_summary && source.last_sync_status === "success" ? (
                      <p className="mt-0.5 max-w-[22rem] text-[11px] text-muted-foreground">
                        {source.last_sync_summary}
                      </p>
                    ) : null}
                    {source.last_sync_error ? (
                      <p className="mt-0.5 max-w-[22rem] text-[11px] text-muted-foreground">
                        {source.last_sync_error}
                      </p>
                    ) : null}
                    {!source.sync_enabled ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Quelle vorbereitet – noch nicht verbunden.
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {source.sync_enabled ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        disabled={sync.isPending}
                        onClick={() => {
                          setBusy(source.id);
                          sync.mutate(source.id);
                        }}
                      >
                        Synchronisieren
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
