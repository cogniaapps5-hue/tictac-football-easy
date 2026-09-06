import { createFileRoute } from "@tanstack/react-router";

// Diagnóstico: solo informa qué nombres de variables existen. Nunca valores.
export const Route = createFileRoute("/api/public/diag-env")({
  server: {
    handlers: {
      GET: async () => {
        const nombres = Object.keys(process.env ?? {})
          .filter((k) => /SUPABASE|SERVICE|LOVABLE/i.test(k))
          .sort();
        return new Response(
          JSON.stringify({
            nombres,
            tieneServiceRole: Boolean(process.env["SUPABASE_SERVICE_ROLE_KEY"]),
            tieneUrl: Boolean(process.env["SUPABASE_URL"]),
          }),
          { headers: { "content-type": "application/json" } },
        );
      },
    },
  },
});
