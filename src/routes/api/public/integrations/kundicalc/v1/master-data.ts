import { createFileRoute } from "@tanstack/react-router";

/** Active categories and planning areas for the KundiCalc selection UI. */
export const Route = createFileRoute("/api/public/integrations/kundicalc/v1/master-data")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const mod = await import("@/lib/integrations/kundicalc.server");
        const auth = await mod.authenticate(request);
        if (auth instanceof Response) return auth;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const [categories, areas] = await Promise.all([
          supabaseAdmin
            .from("categories")
            .select("id, name, sort_order")
            .eq("active", true)
            .order("sort_order", { ascending: true }),
          supabaseAdmin
            .from("planning_areas")
            .select("id, name, sort_order")
            .eq("active", true)
            .order("sort_order", { ascending: true }),
        ]);
        if (categories.error || areas.error) return mod.fail("transaction_failed");

        return Response.json({
          contract_version: mod.CONTRACT_VERSION,
          categories: categories.data ?? [],
          planning_areas: areas.data ?? [],
        });
      },
    },
  },
});
