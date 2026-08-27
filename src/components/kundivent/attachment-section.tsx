import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Download,
  FileImage,
  FileSpreadsheet,
  FileText,
  Mail,
  Paperclip,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ALLOWED_EXTENSIONS,
  attachmentUrl,
  fileExtension,
  formatFileSize,
  useAttachments,
  useDeleteAttachment,
  useUploadAttachments,
  validateFile,
  type EventAttachment,
} from "@/lib/attachments";
import { cn } from "@/lib/utils";

const ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");

function FileIcon({ name }: { name: string }) {
  const ext = fileExtension(name);
  const className = "size-3.5 shrink-0 text-muted-foreground";
  if (["jpg", "jpeg", "png"].includes(ext)) return <FileImage className={className} />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet className={className} />;
  if (["eml", "msg"].includes(ext)) return <Mail className={className} />;
  return <FileText className={className} />;
}

/**
 * Attachments for one event. While a new event has no id yet, files are held
 * as "pending" by the parent and uploaded right after the event is saved.
 */
export function AttachmentSection({
  eventId,
  pendingFiles,
  onPendingFilesChange,
}: {
  eventId: string | null;
  pendingFiles: File[];
  onPendingFilesChange: (files: File[]) => void;
}) {
  const attachments = useAttachments(eventId);
  const upload = useUploadAttachments(eventId);
  const remove = useDeleteAttachment(eventId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [confirm, setConfirm] = useState<EventAttachment | null>(null);

  function acceptFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    const valid: File[] = [];
    for (const file of files) {
      const problem = validateFile(file);
      if (problem) toast.error(problem);
      else valid.push(file);
    }
    if (!valid.length) return;

    if (!eventId) {
      onPendingFilesChange([...pendingFiles, ...valid]);
      return;
    }
    upload.mutate(valid, {
      onSuccess: () => toast.success(valid.length === 1 ? "Datei hochgeladen" : "Dateien hochgeladen"),
      onError: (err) =>
        toast.error("Upload fehlgeschlagen", {
          description: err instanceof Error ? err.message : undefined,
        }),
    });
  }

  async function openAttachment(attachment: EventAttachment) {
    try {
      const url = await attachmentUrl(attachment.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast.error("Datei konnte nicht geöffnet werden", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  function confirmRemove(attachment: EventAttachment) {
    remove.mutate(attachment, {
      onSuccess: () => {
        setConfirm(null);
        toast.success("Anhang entfernt");
      },
      onError: (err) => {
        setConfirm(null);
        toast.error("Entfernen fehlgeschlagen", {
          description: err instanceof Error ? err.message : undefined,
        });
      },
    });
  }

  const rows = attachments.data ?? [];

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5 text-xs">
          <Paperclip className="size-3.5" />
          Anhänge
        </Label>
        {upload.isPending ? (
          <span className="text-[11px] text-muted-foreground">Wird hochgeladen…</span>
        ) : null}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          acceptFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-md border border-dashed px-3 py-4 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/30",
        )}
      >
        <p className="text-[11px] text-muted-foreground">
          Dateien hierher ziehen oder auswählen
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-7 gap-1.5 text-xs"
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-3.5" />
          Dateien auswählen
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            acceptFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="mt-2 text-[10px] text-muted-foreground">
          PDF, Word, Excel, Bilder, TXT, CSV, EML, MSG · max. 20 MB pro Datei
        </p>
      </div>

      {!eventId && pendingFiles.length ? (
        <ul className="space-y-1">
          {pendingFiles.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-sm border border-border bg-card px-2 py-1.5 text-xs"
            >
              <FileIcon name={file.name} />
              <span className="min-w-0 flex-1 truncate">{file.name}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground">nach Speichern</span>
              <button
                type="button"
                aria-label={`${file.name} entfernen`}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => onPendingFilesChange(pendingFiles.filter((_, i) => i !== index))}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {eventId ? (
        rows.length ? (
          <ul className="space-y-1">
            {rows.map((attachment) => (
              <li
                key={attachment.id}
                className="flex items-center gap-2 rounded-sm border border-border bg-card px-2 py-1.5 text-xs"
              >
                <FileIcon name={attachment.file_name} />
                <span className="min-w-0 flex-1 truncate">{attachment.file_name}</span>
                {attachment.source === "email" ? (
                  <span className="shrink-0 rounded-sm bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                    aus E-Mail
                  </span>
                ) : null}
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {formatFileSize(attachment.file_size)}
                </span>
                <button
                  type="button"
                  aria-label={`${attachment.file_name} öffnen`}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => void openAttachment(attachment)}
                >
                  <Download className="size-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`${attachment.file_name} entfernen`}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirm(attachment)}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : attachments.isPending ? (
          <p className="text-[11px] text-muted-foreground">Anhänge werden geladen…</p>
        ) : null
      ) : null}

      <AlertDialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anhang entfernen?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.file_name} wird dauerhaft gelöscht. Der Eintrag bleibt bestehen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (confirm) confirmRemove(confirm);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Entfernen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
