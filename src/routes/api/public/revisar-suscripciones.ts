import { createFileRoute } from "@tanstack/react-router";
import { leerSecretoServidor } from "@/lib/runtime-env.server";

/**
 * Revisión diaria de suscripciones (para un cron externo).
 * Requiere el header `x-cron-key` con la clave de servicio del backend.
 */
export const Route = createFileRoute("/api/public/revisar-suscripciones")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const clave = leerSecretoServidor("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        const enviada = request.headers.get("x-cron-key") ?? "";
        if (!clave || enviada.length !== clave.length || enviada !== clave) {
          return new Response("No autorizado", { status: 401 });
        }
        const { clienteAdmin } = await import("@/lib/matricula.server");
        const { data, error } = await clienteAdmin(clave).rpc("revisar_suscripciones");
        if (error) return new Response(error.message, { status: 500 });
        return Response.json({ ok: true, resultado: data });
      },
    },
  },
});
