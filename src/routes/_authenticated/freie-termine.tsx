import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/kundivent/app-shell";

export const Route = createFileRoute("/_authenticated/freie-termine")({
  head: () => ({
    meta: [
      { title: "Freie Termine – Kundivent" },
      {
        name: "description",
        content: "Übersicht freier Freitage, Samstage und Sonntage für Event-Anfragen.",
      },
      { property: "og:title", content: "Freie Termine – Kundivent" },
      {
        property: "og:description",
        content: "Übersicht freier Freitage, Samstage und Sonntage für Event-Anfragen.",
      },
    ],
  }),
  component: () => (
    <PagePlaceholder
      title="Freie Termine"
      description="Verfügbarkeit für Anfragen"
      phase="Die Verfügbarkeitsprüfung für Freitage, Samstage und Sonntage wird in einer späteren Build-Phase umgesetzt."
    />
  ),
});
