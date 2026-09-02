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
    const runtimeGlobal = globalThis as typeof globalThis & {
      __env__?: Record<string, unknown>;
    };
    const binding = runtimeGlobal.__env__?.["SUPABASE_SERVICE_ROLE_KEY"];
    const clavePrivilegiada =
      typeof binding === "string" && binding.length > 0
        ? binding
        : process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!clavePrivilegiada) {
      throw new Error(
        "El servicio de matrícula no está disponible temporalmente. Intenta nuevamente en unos minutos.",
      );
    }

    return ejecutarMatricula(data, context.supabase, context.userId, clavePrivilegiada);
  });

