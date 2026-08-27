import { useEffect, useState } from "react";

export const OFFLINE_MESSAGE =
  "Keine Internetverbindung. Aktuelle Planungsdaten können momentan nicht geladen oder gespeichert werden.";

/** Throw before any write so offline saves fail visibly instead of silently. */
export function assertOnline() {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    throw new Error(OFFLINE_MESSAGE);
  }
}

export function useIsOnline() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return online;
}

// Tracks whether a form (e.g. the event drawer) holds unsaved changes, so a
// service-worker update never reloads over in-progress edits.
let dirtyForms = 0;

export function setFormDirty(dirty: boolean) {
  dirtyForms = Math.max(0, dirtyForms + (dirty ? 1 : -1));
}

export function hasUnsavedWork() {
  return dirtyForms > 0;
}
