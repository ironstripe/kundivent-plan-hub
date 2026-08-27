import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assertOnline } from "@/lib/connection";
import { supabase } from "@/integrations/supabase/client";
import { cachedFetch } from "@/lib/offline-cache";
import type { Tables } from "@/integrations/supabase/types";

export type PlanningArea = Tables<"planning_areas">;
export type Category = Tables<"categories">;

// Master data is cached locally so the event drawer still offers real
// planning areas and categories while offline.
export const planningAreasQuery = queryOptions({
  queryKey: ["planning_areas"],
  queryFn: (): Promise<PlanningArea[]> =>
    cachedFetch("planning_areas", async () => {
      const { data, error } = await supabase
        .from("planning_areas")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    }),
});

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: (): Promise<Category[]> =>
    cachedFetch("categories", async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    }),
});

export function usePlanningAreas() {
  return useQuery(planningAreasQuery);
}

export function useCategories() {
  return useQuery(categoriesQuery);
}

export type PlanningAreaInput = {
  name: string;
  sort_order: number;
  active: boolean;
};

export function useSavePlanningArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: PlanningAreaInput }) => {
      assertOnline();
      if (id) {
        const { error } = await supabase.from("planning_areas").update(input).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("planning_areas")
        .insert(input)
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planning_areas"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

/** Number of events currently linked to a planning area. */
export async function countPlanningAreaUsage(id: string) {
  const { count, error } = await supabase
    .from("event_planning_areas")
    .select("id", { count: "exact", head: true })
    .eq("planning_area_id", id);
  if (error) throw error;
  return count ?? 0;
}

export function useDeletePlanningArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      const usage = await countPlanningAreaUsage(id);
      if (usage > 0) {
        throw new Error(
          `Dieser Bereich wird in ${usage} ${usage === 1 ? "Eintrag" : "Einträgen"} verwendet und kann nicht gelöscht werden. Er kann stattdessen deaktiviert werden.`,
        );
      }
      const { error } = await supabase.from("planning_areas").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["planning_areas"] });
    },
  });
}
