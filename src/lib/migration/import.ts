import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MigrationRecord } from "./parse";
import { MIGRATION_SOURCE } from "./parse";

export function useMigratedRefs() {
  return useQuery({
    queryKey: ["migrated_refs"],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("events")
        .select("migration_source_ref")
        .eq("migration_source", MIGRATION_SOURCE);
      if (error) throw error;
      return (data ?? [])
        .map((row) => row.migration_source_ref)
        .filter((ref): ref is string => Boolean(ref));
    },
  });
}

export type ImportOutcome = {
  imported: number;
  duplicates: number;
  failed: { ref: string; message: string }[];
};

export function useImportMigration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      records,
      areaIds,
      categoryIds,
      existingRefs,
    }: {
      records: MigrationRecord[];
      areaIds: Map<string, string>;
      categoryIds: Map<string, string>;
      existingRefs: Set<string>;
    }): Promise<ImportOutcome> => {
      const outcome: ImportOutcome = { imported: 0, duplicates: 0, failed: [] };

      for (const record of records) {
        if (existingRefs.has(record.ref)) {
          outcome.duplicates += 1;
          continue;
        }
        const categoryId = categoryIds.get(record.categoryName);
        const linkIds = record.areaNames
          .map((name) => areaIds.get(name))
          .filter((id): id is string => Boolean(id));

        if (!categoryId || linkIds.length === 0) {
          outcome.failed.push({
            ref: record.ref,
            message: !categoryId
              ? `Kategorie «${record.categoryName}» nicht gefunden`
              : "Kein gültiger Planungsbereich zugeordnet",
          });
          continue;
        }

        const { data, error } = await supabase
          .from("events")
          .insert({
            title: record.title,
            category_id: categoryId,
            start_date: record.startDate,
            end_date: record.endDate,
            all_day: record.allDay,
            start_time: record.startTime,
            end_time: record.endTime,
            status: record.status,
            pax: record.pax,
            notes: record.notes,
            migration_source: MIGRATION_SOURCE,
            migration_source_ref: record.ref,
            migration_review_required: record.reviewRequired,
          })
          .select("id")
          .single();

        if (error || !data) {
          outcome.failed.push({ ref: record.ref, message: error?.message ?? "Unbekannter Fehler" });
          continue;
        }

        const { error: linkError } = await supabase.from("event_planning_areas").insert(
          linkIds.map((planning_area_id) => ({
            event_id: data.id,
            planning_area_id,
          })),
        );
        if (linkError) {
          outcome.failed.push({ ref: record.ref, message: linkError.message });
          continue;
        }
        existingRefs.add(record.ref);
        outcome.imported += 1;
      }

      return outcome;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["migrated_refs"] });
    },
  });
}
