import { createServerFn } from "@tanstack/react-start";
import { exigirAuthSupabase } from "@/lib/auth-middleware.server";
import { ejecutarMatricula } from "@/lib/matricula.server";
import { matriculaSchema } from "@/lib/matricula.schema";
import type { EntradaMatricula, ResultadoMatricula } from "@/lib/matricula.schema";

export type { EntradaMatricula, ResultadoMatricula };

export const matricularAlumno = createServerFn({ method: "POST" })
  .middleware([exigirAuthSupabase])
  .validator((data: unknown) => matriculaSchema.parse(data))
  .handler(({ data, context }): Promise<ResultadoMatricula> => {
    // La plataforma inyecta secretos por solicitud. Esta lectura debe ser
    // directa y literal dentro del handler; un helper dinámico no se enlaza
    // correctamente en el despliegue de producción.
    const clavePrivilegiada = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!clavePrivilegiada) {
      throw new Error(
        "El servicio de matrícula no está disponible temporalmente. Intenta nuevamente en unos minutos.",
      );
    }

    return ejecutarMatricula(data, context.supabase, context.userId, clavePrivilegiada);
  });

