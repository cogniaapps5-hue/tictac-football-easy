import { createServerFn } from "@tanstack/react-start";
import { exigirAuthSupabase } from "@/lib/auth-middleware.server";
import { ejecutarMatricula } from "@/lib/matricula.server";
import { matriculaSchema } from "@/lib/matricula.schema";
import type { EntradaMatricula, ResultadoMatricula } from "@/lib/matricula.schema";

export type { EntradaMatricula, ResultadoMatricula };

export const matricularAlumno = createServerFn({ method: "POST" })
  .middleware([exigirAuthSupabase])
  .validator((data: unknown) => matriculaSchema.parse(data))
  .handler(async ({ data, context }): Promise<ResultadoMatricula> => {
    const { leerSecretoServidor } = await import("@/lib/runtime-env.server");
    const clavePrivilegiada = leerSecretoServidor("SUPABASE_SERVICE_ROLE_KEY");
    if (!clavePrivilegiada) {
      console.error("[matricula] SUPABASE_SERVICE_ROLE_KEY ausente en los bindings de la solicitud");
      throw new Error(
        "El servicio de matrícula no está disponible temporalmente. Intenta nuevamente en unos minutos.",
      );
    }

    return ejecutarMatricula(data, context.supabase, context.userId, clavePrivilegiada);
  });

