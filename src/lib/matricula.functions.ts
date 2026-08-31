import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ejecutarMatricula, ejecutarTestMatricula } from "@/lib/matricula.server";
import { matriculaSchema } from "@/lib/matricula.schema";
import type {
  EntradaMatricula,
  ResultadoMatricula,
  ResultadoTestMatricula,
} from "@/lib/matricula.schema";

export type { EntradaMatricula, ResultadoMatricula, ResultadoTestMatricula };

export const matricularAlumno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => matriculaSchema.parse(data))
  .handler(({ data, context }): Promise<ResultadoMatricula> =>
    ejecutarMatricula(data, context.supabase, context.userId),
  );

export const probarRegistroAlumno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(({ context }): Promise<ResultadoTestMatricula> =>
    ejecutarTestMatricula(context.supabase, context.userId),
  );