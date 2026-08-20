import { queryOptions, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type PlanningArea = Tables<"planning_areas">;
export type Category = Tables<"categories">;

export const planningAreasQuery = queryOptions({
  queryKey: ["planning_areas"],
  queryFn: async (): Promise<PlanningArea[]> => {
    const { data, error } = await supabase
      .from("planning_areas")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
});

export const categoriesQuery = queryOptions({
  queryKey: ["categories"],
  queryFn: async (): Promise<Category[]> => {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
});

export function usePlanningAreas() {
  return useQuery(planningAreasQuery);
}

export function useCategories() {
  return useQuery(categoriesQuery);
}
