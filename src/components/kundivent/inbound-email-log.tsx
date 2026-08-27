import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { formatEmailDateTime } from "@/lib/event-email";

type LogRow = Tables<"inbound_email_log">;

const OUTCOME_LABEL: Record<string, string> = {
  stored: "Zugeordnet",
  duplicate: "Doppelt",
  no_token: "Kein Token",
  unknown_token: "Token unbekannt",
  ignored: "Ignoriert",
  error: "Fehler",
};

function OutcomeBadge({ outcome }: { outcome: string }) {
  const label = OUTCOME_LABEL[outcome] ?? outcome;
  const variant = outcome === "stored" ? "secondary" : outcome === "duplicate" ? "outline" : "destructive";
  return (
    <Badge variant={variant} className="text-[11px] font-normal">
      {label}
    </Badge>
  );
}

/** Admin-only view of every inbound delivery, so failed matches are visible. */
export function InboundEmailLog() {
  const log = useQuery({
    queryKey: ["inbound_email_log"],
    queryFn: async (): Promise<LogRow[]> => {
      const { data, error } = await supabase
        .from("inbound_email_log")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-medium">Eingehende E-Mails (Protokoll)</h2>
          <p className="text-[11px] text-muted-foreground">
            Letzte 50 Zustellungen an die Eintrags-Adressen – inklusive nicht zugeordneter Mails.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 px-2.5 text-xs"
          onClick={() => void log.refetch()}
        >
          <RefreshCw className="size-3.5" />
          Aktualisieren
        </Button>
      </div>

      {log.isLoading ? (
        <p className="text-xs text-muted-foreground">Protokoll wird geladen…</p>
      ) : log.isError ? (
        <p className="text-xs text-muted-foreground">Protokoll konnte nicht geladen werden.</p>
      ) : !log.data?.length ? (
        <p className="text-xs text-muted-foreground">
          Noch keine Zustellungen empfangen. Sobald Resend eine Mail an den Webhook liefert,
          erscheint sie hier.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Zeit</TableHead>
                <TableHead className="text-xs">Von</TableHead>
                <TableHead className="text-xs">An</TableHead>
                <TableHead className="text-xs">Betreff</TableHead>
                <TableHead className="text-xs">Ergebnis</TableHead>
                <TableHead className="text-xs">Hinweis</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {log.data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {formatEmailDateTime(row.received_at)}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-xs">
                    {row.from_address ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs">
                    {row.recipients ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-xs">
                    {row.subject ?? "—"}
                  </TableCell>
                  <TableCell>
                    <OutcomeBadge outcome={row.outcome} />
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                    {row.detail ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
