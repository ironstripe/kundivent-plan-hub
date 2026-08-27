import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, Mail, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AttachmentSection } from "@/components/kundivent/attachment-section";
import { attachmentUrl, formatFileSize } from "@/lib/attachments";
import { eventEmailAddress, eventEmailCode, formatEmailDateTime } from "@/lib/event-email";
import {
  emailPreview,
  senderLabel,
  useEventEmails,
  type EventEmailWithAttachments,
} from "@/lib/event-emails";
import { sanitizeEmailHtml } from "@/lib/sanitize-html";

const HELPER_TEXT =
  "Relevante E-Mails an diese Adresse weiterleiten. Sie werden automatisch diesem Eintrag zugeordnet.";

function CopyRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Kopiert");
    } catch {
      toast.error("Kopieren nicht möglich", { description: value });
    }
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs">
          {value}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 px-2.5 text-xs"
          onClick={() => void copy()}
        >
          <Copy className="size-3.5" />
          Kopieren
        </Button>
      </div>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function EmailAddressRow({ token }: { token: string }) {
  return (
    <div className="space-y-2.5">
      <CopyRow
        label="E-Mail-Adresse für diesen Eintrag"
        value={eventEmailAddress(token)}
        hint={HELPER_TEXT}
      />
      <CopyRow
        label="Zuordnungscode (alternativ im Betreff)"
        value={eventEmailCode(token)}
        hint="Falls die Weiterleitung an die Adresse nicht klappt: diesen Code irgendwo in den Betreff schreiben."
      />
    </div>
  );
}


function AttachmentLink({
  name,
  path,
  size,
}: {
  name: string;
  path: string;
  size: number | null;
}) {
  const open = async () => {
    try {
      const url = await attachmentUrl(path);
      window.open(url, "_blank", "noopener");
    } catch {
      toast.error("Anhang konnte nicht geöffnet werden");
    }
  };
  return (
    <button
      type="button"
      onClick={() => void open()}
      className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
    >
      <Paperclip className="size-3" />
      <span className="max-w-[180px] truncate">{name}</span>
      {size ? <span className="text-muted-foreground">{formatFileSize(size)}</span> : null}
    </button>
  );
}

function EmailDetail({
  email,
  onBack,
}: {
  email: EventEmailWithAttachments;
  onBack: () => void;
}) {
  const html = email.html_body ? sanitizeEmailHtml(email.html_body) : null;
  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 gap-1.5 px-1.5 text-xs"
        onClick={onBack}
      >
        <ArrowLeft className="size-3.5" />
        Zurück
      </Button>
      <div className="space-y-0.5">
        <p className="text-sm font-medium">{email.subject || "(Kein Betreff)"}</p>
        <p className="text-[11px] text-muted-foreground">
          Von {senderLabel(email)} · an {email.to_address}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {formatEmailDateTime(email.received_at)}
        </p>
      </div>
      {email.attachments.length ? (
        <div className="flex flex-wrap gap-1.5">
          {email.attachments.map((a) => (
            <AttachmentLink key={a.id} name={a.file_name} path={a.storage_path} size={a.file_size} />
          ))}
        </div>
      ) : null}
      <div className="rounded-md border border-border bg-card p-3">
        {html ? (
          <iframe
            title="E-Mail-Inhalt"
            sandbox=""
            srcDoc={html}
            className="h-72 w-full border-0 bg-white"
          />
        ) : (
          <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed">
            {email.text_body || "Kein Inhalt vorhanden."}
          </pre>
        )}
      </div>
    </div>
  );
}

function EmailList({
  eventId,
  onOpen,
}: {
  eventId: string;
  onOpen: (email: EventEmailWithAttachments) => void;
}) {
  const emails = useEventEmails(eventId);

  if (emails.isLoading) {
    return <p className="text-xs text-muted-foreground">E-Mails werden geladen…</p>;
  }
  if (emails.isError) {
    return (
      <p className="text-xs text-muted-foreground">
        E-Mails konnten nicht geladen werden (evtl. offline).
      </p>
    );
  }
  if (!emails.data?.length) {
    return (
      <p className="text-xs text-muted-foreground">
        Noch keine E-Mails. Leite eine Nachricht an die obige Adresse weiter.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {emails.data.map((email) => {
        const preview = emailPreview(email);
        return (
          <li key={email.id}>
            <button
              type="button"
              onClick={() => onOpen(email)}
              className="w-full space-y-0.5 px-2.5 py-2 text-left hover:bg-muted/60"
            >
              <p className="truncate text-xs font-medium">{email.subject || "(Kein Betreff)"}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {email.from_address} · {formatEmailDateTime(email.received_at)}
              </p>
              {preview ? (
                <p className="truncate text-[11px] text-muted-foreground">{preview}</p>
              ) : null}
              {email.attachments.length ? (
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Paperclip className="size-3" />
                  {email.attachments.length}{" "}
                  {email.attachments.length === 1 ? "Anhang" : "Anhänge"}
                </p>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * "Kommunikation" block of the event drawer: forwarding address, archived
 * e-mails (read-only) and the existing manual file attachments.
 */
export function CommunicationSection({
  eventId,
  inboundToken,
  pendingFiles,
  onPendingFilesChange,
}: {
  eventId: string | null;
  inboundToken: string | null;
  pendingFiles: File[];
  onPendingFilesChange: (files: File[]) => void;
}) {
  const [openEmail, setOpenEmail] = useState<EventEmailWithAttachments | null>(null);

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="flex items-center gap-1.5">
        <Mail className="size-3.5 text-muted-foreground" />
        <Label className="text-xs font-medium">Kommunikation</Label>
      </div>

      {inboundToken ? (
        <>
          <EmailAddressRow token={inboundToken} />
          <p className="text-[11px] leading-snug text-muted-foreground">
            Nur diese exakte Adresse (mit dem Code nach dem „+“) ordnet die E-Mail diesem Eintrag
            zu. Alternativ genügt der Code {eventEmailCode(inboundToken)} im Betreff.
          </p>
        </>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Die E-Mail-Adresse für diesen Eintrag wird nach dem Speichern angezeigt.
        </p>
      )}

      <Tabs defaultValue="emails">
        <TabsList className="h-8">
          <TabsTrigger value="emails" className="h-6 px-2.5 text-xs">
            E-Mails
          </TabsTrigger>
          <TabsTrigger value="files" className="h-6 px-2.5 text-xs">
            Dateien
          </TabsTrigger>
        </TabsList>

        <TabsContent value="emails" className="mt-2.5">
          {!eventId ? (
            <p className="text-xs text-muted-foreground">
              E-Mails sind verfügbar, sobald der Eintrag gespeichert ist.
            </p>
          ) : openEmail ? (
            <EmailDetail email={openEmail} onBack={() => setOpenEmail(null)} />
          ) : (
            <EmailList eventId={eventId} onOpen={setOpenEmail} />
          )}
        </TabsContent>

        <TabsContent value="files" className="mt-2.5">
          <AttachmentSection
            eventId={eventId}
            pendingFiles={pendingFiles}
            onPendingFilesChange={onPendingFilesChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
