import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assertOnline } from "@/lib/connection";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { RadarRelevance, RadarType } from "@/lib/radar/types";

export type RadarEvent = Tables<"radar_events">;
export type RadarThemeDay = Tables<"radar_theme_days">;

/** All Radar entries overlapping the given inclusive date range. */
export function useRadarEvents(fromDate: string, toDate: string) {
  return useQuery({
    queryKey: ["radar_events", fromDate, toDate],
    queryFn: async (): Promise<RadarEvent[]> => {
      const { data, error } = await supabase
        .from("radar_events")
        .select("*")
        .eq("active", true)
        .lte("start_date", toDate)
        .or(`end_date.gte.${fromDate},and(end_date.is.null,start_date.gte.${fromDate})`)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useThemeDays() {
  return useQuery({
    queryKey: ["radar_theme_days"],
    queryFn: async (): Promise<RadarThemeDay[]> => {
      const { data, error } = await supabase
        .from("radar_theme_days")
        .select("*")
        .order("month")
        .order("day");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type ManualRadarInput = {
  title: string;
  start_date: string;
  end_date: string | null;
  location_name: string | null;
  city: string | null;
  canton: string | null;
  category: string;
  relevance: RadarRelevance;
  description: string | null;
  source_url: string | null;
};

function manualSourceKey(input: ManualRadarInput) {
  const slug = input.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `manual:${input.start_date}:${slug}:${Date.now().toString(36)}`;
}

export function useSaveManualRadarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ManualRadarInput }) => {
      assertOnline();
      const row = {
        ...input,
        type: "regional_event" as RadarType,
        source_id: "manual",
        is_manual: true,
        active: true,
        all_day: true,
      };
      if (id) {
        const { error } = await supabase.from("radar_events").update(row).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data: auth } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("radar_events")
        .insert({
          ...row,
          source_key: manualSourceKey(input),
          created_by: auth.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["radar_events"] }),
  });
}

export function useDeleteManualRadarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      assertOnline();
      const { error } = await supabase
        .from("radar_events")
        .delete()
        .eq("id", id)
        .eq("is_manual", true);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["radar_events"] }),
  });
}

/* ------------------------------------------------------------------ */
/* Layer selection (persisted locally)                                  */
/* ------------------------------------------------------------------ */

export type RadarLayers = {
  schoolCantons: string[];
  holidayCantons: string[];
  cities: string[];
  themeCategories: string[];
  showKundivent: boolean;
  showLowRelevance: boolean;
};

export const DEFAULT_LAYERS: RadarLayers = {
  schoolCantons: ["SH", "TG"],
  holidayCantons: ["CH", "SH", "TG"],
  cities: ["Schaffhausen", "Stein am Rhein", "Diessenhofen", "Frauenfeld"],
  themeCategories: ["Fisch & Genuss", "Natur & Umwelt", "Familie & Freizeit"],
  showKundivent: true,
  showLowRelevance: false,
};

const STORAGE_KEY = "kundivent.radar.layers";

export function useRadarLayers() {
  const [layers, setLayers] = useState<RadarLayers>(DEFAULT_LAYERS);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setLayers({ ...DEFAULT_LAYERS, ...(JSON.parse(raw) as Partial<RadarLayers>) });
    } catch {
      // ignore unreadable local state
    }
  }, []);

  const update = (next: Partial<RadarLayers>) => {
    setLayers((prev) => {
      const merged = { ...prev, ...next };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // storage unavailable — selection stays for this session only
      }
      return merged;
    });
  };

  const toggleIn = (key: "schoolCantons" | "holidayCantons" | "cities" | "themeCategories", value: string) => {
    setLayers((prev) => {
      const list = prev[key];
      const merged = {
        ...prev,
        [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // ignore
      }
      return merged;
    });
  };

  return { layers, update, toggleIn };
}

/** Layer + relevance filtering, shared by month and year view. */
export function filterRadarEvents(events: RadarEvent[], layers: RadarLayers) {
  return events.filter((event) => {
    if (!layers.showLowRelevance && event.relevance === "low" && event.type !== "school_holiday" && event.type !== "public_holiday") {
      return false;
    }
    switch (event.type) {
      case "school_holiday":
        return layers.schoolCantons.includes(event.canton ?? "");
      case "public_holiday":
        return layers.holidayCantons.includes(event.canton ?? "");
      case "regional_event":
        return !event.city || layers.cities.includes(event.city);
      case "theme_day":
        return layers.themeCategories.includes(event.category ?? "");
      default:
        return true;
    }
  });
}

export function eachDateInRange(start: string, end: string | null) {
  const dates: string[] = [];
  const from = new Date(`${start}T00:00:00Z`);
  const to = new Date(`${end ?? start}T00:00:00Z`);
  for (let d = from; d <= to; d = new Date(d.getTime() + 86400000)) {
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function overlapsDate(event: RadarEvent, date: string) {
  const end = event.end_date ?? event.start_date;
  return event.start_date <= date && date <= end;
}
