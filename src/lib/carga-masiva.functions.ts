import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const filaApoderado = z.object({
  email: z.string().trim().email().max(255),
  nombre: z.string().trim().max(120).default(""),
  telefono: z.string().trim().max(40).default(""),
});

const filaAlumno = z.object({
  nombre: z.string().trim().min(1).max(120),
  rut: z.string().trim().max(20).default(""),
  edad: z.number().int().min(3).max(30).nullable().default(null),
  apoderado_email: z.string().trim().max(255).default(""),
  dia: z.enum(["martes", "jueves"]).default("martes"),
});

const filaPago = z.object({
  alumno_rut: z.string().trim().min(1).max(20),
  monto: z.number().int().min(0).max(10_000_000).default(20000),
  concepto: z.string().trim().max(120).default("Mensualidad"),
});

const entrada = z.object({
  apoderados: z.array(filaApoderado).max(500).default([]),
  alumnos: z.array(filaAlumno).max(500).default([]),
  pagos: z.array(filaPago).max(1000).default([]),
});

export type EntradaCarga = z.input<typeof entrada>;

export type ResultadoCarga = {
  apoderados: number;
  alumnos: number;
  pagos: number;
  errores: string[];
};

function anioNacimiento(edad: number | null) {
  const actual = new Date().getFullYear();
  if (edad == null) return actual - 8;
  if (edad > 1900) return edad; // vino un año en vez de una edad
  return actual - edad;
}

function grupo(anio: number) {
  if (anio >= 2018) return "iniciados" as const;
  if (anio >= 2016) return "intermedios" as const;
  return "avanzados" as const;
}

export const cargaMasiva = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entrada.parse(data))
  .handler(async ({ data, context }): Promise<ResultadoCarga> => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (!roles?.length) throw new Error("Solo la administradora puede cargar datos");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const errores: string[] = [];
    let creadosApoderados = 0;

    for (const fila of data.apoderados) {
      const email = fila.email.toLowerCase();
      const { data: existente } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (existente) {
        await supabaseAdmin
          .from("profiles")
          .update({
            full_name: fila.nombre || undefined,
            phone: fila.telefono || undefined,
          })
          .eq("id", existente.id);
        errores.push(`Apoderado ${email}: ya existía, se actualizaron sus datos`);
        continue;
      }
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: `TicTac-${crypto.randomUUID().slice(0, 12)}`,
        email_confirm: true,
        user_metadata: { full_name: fila.nombre, phone: fila.telefono },
      });
      if (error) {
        errores.push(`Apoderado ${email}: ${error.message}`);
        continue;
      }
      creadosApoderados += 1;
    }

    let creadosAlumnos = 0;
    for (const fila of data.alumnos) {
      const email = fila.apoderado_email.toLowerCase() || null;
      let parentId: string | null = null;
      if (email) {
        const { data: perfil } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        parentId = perfil?.id ?? null;
      }
      const anio = anioNacimiento(fila.edad);
      const rut = fila.rut || null;
      if (rut) {
        const { data: yaExiste } = await supabaseAdmin
          .from("players")
          .select("id")
          .eq("rut", rut)
          .maybeSingle();
        if (yaExiste) {
          errores.push(`Alumno ${fila.nombre} (RUT ${rut}): ya estaba registrado`);
          continue;
        }
      }
      const { error } = await supabaseAdmin.from("players").insert({
        name: fila.nombre,
        rut,
        birth_year: anio,
        age_group: grupo(anio),
        training_day: fila.dia,
        parent_email: email,
        parent_id: parentId,
      });
      if (error) {
        errores.push(`Alumno ${fila.nombre}: ${error.message}`);
        continue;
      }
      creadosAlumnos += 1;
    }

    let creadosPagos = 0;
    for (const fila of data.pagos) {
      const { data: alumno } = await supabaseAdmin
        .from("players")
        .select("id")
        .eq("rut", fila.alumno_rut)
        .maybeSingle();
      if (!alumno) {
        errores.push(`Pago RUT ${fila.alumno_rut}: no encontramos ese alumno`);
        continue;
      }
      const { error } = await supabaseAdmin.from("payments").insert({
        player_id: alumno.id,
        amount: fila.monto,
        concept: fila.concepto || "Mensualidad",
        status: "pending",
      });
      if (error) {
        errores.push(`Pago RUT ${fila.alumno_rut}: ${error.message}`);
        continue;
      }
      creadosPagos += 1;
    }

    return {
      apoderados: creadosApoderados,
      alumnos: creadosAlumnos,
      pagos: creadosPagos,
      errores,
    };
  });