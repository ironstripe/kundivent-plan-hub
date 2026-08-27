import { queryOptions, useQuery } from "@tanstack/react-query";
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
