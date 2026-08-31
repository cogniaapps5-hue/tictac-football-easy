import { createServerFn } from "@tanstack/react-start";
import { exigirAuthSupabase } from "@/lib/auth-middleware.server";
import { ejecutarMatricula } from "@/lib/matricula.server";
import { matriculaSchema } from "@/lib/matricula.schema";
import type { EntradaMatricula, ResultadoMatricula } from "@/lib/matricula.schema";

export type { EntradaMatricula, ResultadoMatricula };

export const matricularAlumno = createServerFn({ method: "POST" })
  .middleware([exigirAuthSupabase])
  .validator((data: unknown) => matriculaSchema.parse(data))
  .handler(({ data, context }): Promise<ResultadoMatricula> =>
    ejecutarMatricula(data, context.supabase, context.userId),
  );

