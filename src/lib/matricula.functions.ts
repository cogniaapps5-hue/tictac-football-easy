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
    let clavePrivilegiada = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!clavePrivilegiada) {
      const { leerBindingCloudflare } = await import("@/lib/cloudflare-env.server");
      clavePrivilegiada = leerBindingCloudflare("SUPABASE_SERVICE_ROLE_KEY");
    }
    if (!clavePrivilegiada) {
      console.error("[matricula] SUPABASE_SERVICE_ROLE_KEY ausente en process.env y Cloudflare env");
      throw new Error(
        "El servicio de matrícula no está disponible temporalmente. Intenta nuevamente en unos minutos.",
      );
    }

    return ejecutarMatricula(data, context.supabase, context.userId, clavePrivilegiada);
  });

