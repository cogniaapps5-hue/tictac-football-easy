import { createServerFn } from "@tanstack/react-start";
import { leerSecretoServidor } from "@/lib/runtime-env.server";
import { exigirAuthSupabase } from "@/lib/auth-middleware.server";
import { ejecutarMatricula } from "@/lib/matricula.server";
import { matriculaSchema } from "@/lib/matricula.schema";
import type { EntradaMatricula, ResultadoMatricula } from "@/lib/matricula.schema";

export type { EntradaMatricula, ResultadoMatricula };

export const matricularAlumno = createServerFn({ method: "POST" })
  .middleware([exigirAuthSupabase])
  .validator((data: unknown) => matriculaSchema.parse(data))
  .handler(({ data, context }): Promise<ResultadoMatricula> => {
    // Las variables privadas del runtime se garantizan dentro del handler.
    // Leerlas aquí evita depender del momento en que se cargan los módulos.
    const clavePrivilegiada = leerSecretoServidor("SUPABASE_SERVICE_ROLE_KEY");
    if (!clavePrivilegiada) {
      throw new Error(
        "El servicio de matrícula no está disponible temporalmente. Intenta nuevamente en unos minutos.",
      );
    }

    return ejecutarMatricula(data, context.supabase, context.userId, clavePrivilegiada);
  });

