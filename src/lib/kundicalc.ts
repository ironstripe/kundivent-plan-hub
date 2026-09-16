import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assertOnline } from "@/lib/connection";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const KUNDICALC_SOURCE_SYSTEM = "kundicalc";

export type Handover = Tables<"integration_handovers">;
export type IntegrationUserMapping = Tables<"integration_user_map">;

/** KundiCalc association of a single event (read-only, no reverse sync). */
export function useEventHandover(eventId: string | null) {
  return useQuery({
    queryKey: ["kundicalc-handover", eventId],
    enabled: !!eventId,
    queryFn: async (): Promise<Handover | null> => {
      const { data, error } = await supabase
        .from("integration_handovers")
        .select("*")
        .eq("target_event_id", eventId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

/** Admin-only mapping between KundiCalc users and Kundivent users. */
export function useIntegrationUserMap() {
  return useQuery({
    queryKey: ["integration-user-map"],
    queryFn: async (): Promise<IntegrationUserMapping[]> => {
      const { data, error } = await supabase
        .from("integration_user_map")
        .select("*")
        .eq("source_system", KUNDICALC_SOURCE_SYSTEM)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveIntegrationMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      source_actor_id: string;
      profile_id: string;
      active: boolean;
      note: string | null;
    }) => {
      assertOnline();
      const row = {
        source_system: KUNDICALC_SOURCE_SYSTEM,
        source_actor_id: input.source_actor_id.trim(),
        profile_id: input.profile_id,
        active: input.active,
        note: input.note,
      };
      if (!row.source_actor_id) throw new Error("Bitte die KundiCalc-Benutzerkennung angeben.");
      if (input.id) {
        const { error } = await supabase
          .from("integration_user_map")
          .update(row)
          .eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await supabase
        .from("integration_user_map")
        .insert(row)
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505")
          throw new Error("Für diese KundiCalc-Kennung besteht bereits eine Zuordnung.");
        throw error;
      }
      return data.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integration-user-map"] }),
  });
}

export function useDeleteIntegrationMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      const { error } = await supabase.from("integration_user_map").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integration-user-map"] }),
  });
}
