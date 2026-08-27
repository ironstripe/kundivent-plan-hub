import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const ATTACHMENT_BUCKET = "event-attachments";
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "jpg",
  "jpeg",
  "png",
  "txt",
  "csv",
  "eml",
  "msg",
] as const;

export type EventAttachment = Tables<"event_attachments">;

export function fileExtension(name: string) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop()!.toLowerCase() : "";
}

export function isAllowedFile(name: string) {
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

export function formatFileSize(bytes: number | null | undefined) {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Human validation message, or null when the file may be uploaded. */
export function validateFile(file: File): string | null {
  if (!isAllowedFile(file.name)) return `${file.name}: Dateityp nicht unterstützt`;
  if (file.size > MAX_ATTACHMENT_BYTES) return `${file.name}: grösser als 20 MB`;
  return null;
}

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120);
}

export function attachmentsQueryKey(eventId: string) {
  return ["event_attachments", eventId] as const;
}

export function useAttachments(eventId: string | null | undefined) {
  return useQuery({
    queryKey: attachmentsQueryKey(eventId ?? "none"),
    enabled: Boolean(eventId),
    queryFn: async (): Promise<EventAttachment[]> => {
      const { data, error } = await supabase
        .from("event_attachments")
        .select("*")
        .eq("event_id", eventId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Uploads one file to storage and records its metadata row. */
export async function uploadAttachment(eventId: string, file: File) {
  const problem = validateFile(file);
  if (problem) throw new Error(problem);

  const path = `${eventId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (uploadError) throw uploadError;

  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from("event_attachments").insert({
    event_id: eventId,
    file_name: file.name,
    storage_path: path,
    mime_type: file.type || null,
    file_size: file.size,
    uploaded_by: auth.user?.id ?? null,
  });
  if (error) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([path]);
    throw error;
  }
}

export function useUploadAttachments(eventId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (files: File[]) => {
      if (!eventId) throw new Error("Eintrag muss zuerst gespeichert werden.");
      for (const file of files) await uploadAttachment(eventId, file);
    },
    onSuccess: () => {
      if (eventId) queryClient.invalidateQueries({ queryKey: attachmentsQueryKey(eventId) });
    },
  });
}

export function useDeleteAttachment(eventId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (attachment: EventAttachment) => {
      const { error: storageError } = await supabase.storage
        .from(ATTACHMENT_BUCKET)
        .remove([attachment.storage_path]);
      if (storageError) throw storageError;
      const { error } = await supabase
        .from("event_attachments")
        .delete()
        .eq("id", attachment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (eventId) queryClient.invalidateQueries({ queryKey: attachmentsQueryKey(eventId) });
    },
  });
}

/** Short-lived signed URL — the bucket itself stays private. */
export async function attachmentUrl(storagePath: string) {
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(storagePath, 60 * 5);
  if (error) throw error;
  return data.signedUrl;
}
