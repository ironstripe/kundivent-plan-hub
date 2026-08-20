import { createFileRoute } from "@tanstack/react-router";
import { PagePlaceholder } from "@/components/kundivent/app-shell";

export const Route = createFileRoute("/_authenticated/eintraege")({
  head: () => ({
    meta: [
      { title: "Einträge – Kundivent" },
      {
        name: "description",
        content: "Listenansicht aller Events, Belegungen und Betriebsferien.",
      },
      { property: "og:title", content: "Einträge – Kundivent" },
      {
        property: "og:description",
        content: "Listenansicht aller Events, Belegungen und Betriebsferien.",
      },
    ],
  }),
  component: () => (
    <PagePlaceholder
      title="Einträge"
      description="Liste aller Planungseinträge"
      phase="Das Erfassen und Bearbeiten von Einträgen wird in Phase 02 umgesetzt."
    />
  ),
});
