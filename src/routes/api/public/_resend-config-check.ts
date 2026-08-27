import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Temporärer Diagnose-Endpunkt: prüft serverseitig, welche Webhooks in Resend
 * registriert sind (URL + aktivierte Events). Nur für eingeloggte Admins.
 * Gibt bewusst keine Secrets oder fremden URLs vollständig aus.
 */
export const Route = createFileRoute("/api/public/_resend-config-check")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = request.headers.get("Authorization") ?? "";
        const token = auth.replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });

        const url = process.env["SUPABASE_URL"]!;
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const supabase = createClient(url, key, {
          auth: { persistSession: false },
          global: {
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
              h.set("apikey", key);
              return fetch(input, { ...init, headers: h });
            },
          },
        });
        const { data: userData } = await supabase.auth.getUser(token);
        const userId = userData.user?.id;
        if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

        // Eigenes Profil ist per RLS lesbar; is_admin reicht als Admin-Nachweis.
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin")
          .eq("id", userId)
          .single();
        if (!profile?.is_admin) return Response.json({ error: "forbidden" }, { status: 403 });

        const resendKey = process.env["RESEND_API_KEY"];
        if (!resendKey) return Response.json({ error: "RESEND_API_KEY fehlt" }, { status: 500 });

        const res = await fetch("https://api.resend.com/webhooks", {
          headers: { Authorization: `Bearer ${resendKey}` },
        });
        if (!res.ok) {
          return Response.json({ error: `Resend API: ${res.status} ${await res.text()}` }, { status: 502 });
        }
        const body = (await res.json()) as {
          data?: { id: string; endpoint: string; status?: string; events?: string[] }[];
        };
        const webhooks = (body.data ?? []).map((w) => ({
          id: w.id,
          endpoint: w.endpoint,
          status: w.status ?? null,
          events: w.events ?? [],
        }));
        return Response.json({
          webhooks,
          has_resend_api_key: true,
          has_webhook_secret: Boolean(process.env["RESEND_WEBHOOK_SECRET"]),
        });
      },
    },
  },
});
