import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const filaApoderado = z.object({
  nombre: z.string().trim().max(120).default(""),
  rut: z.string().trim().max(20).default(""),
  email: z.string().trim().email().max(255),
  telefono: z.string().trim().max(40).default(""),
});

const filaAlumno = z.object({
  nombre: z.string().trim().min(1).max(120),
  rut: z.string().trim().max(20).default(""),
  fecha_nacimiento: z.string().trim().max(20).default(""),
  talla_polera: z.string().trim().max(5).default(""),
  condiciones_medicas: z.string().trim().max(1000).default(""),
  nombre_emergencia: z.string().trim().max(120).default(""),
  telefono_emergencia: z.string().trim().max(40).default(""),
  parentesco: z.string().trim().max(60).default(""),
  apoderado_email: z.string().trim().max(255).default(""),
  dia: z.enum(["martes", "jueves"]).default("martes"),
  monto_inicial: z.number().int().min(0).max(10_000_000).nullable().default(null),
  concepto_inicial: z.string().trim().max(120).default(""),
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

// Acepta DD-MM-AAAA (también DD/MM/AAAA) y AAAA-MM-DD.
export function parseFechaNacimiento(valor: string): string | null {
  const limpio = valor.trim();
  if (!limpio) return null;
  let anio: number, mes: number, dia: number;
  const iso = limpio.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  const cl = limpio.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (iso) [, anio, mes, dia] = iso.map(Number) as unknown as number[];
  else if (cl) {
    dia = Number(cl[1]);
    mes = Number(cl[2]);
    anio = Number(cl[3]);
  } else return null;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || anio < 1950 || anio > 2100) return null;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCMonth() !== mes - 1 || fecha.getUTCDate() !== dia) return null;
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function edadDesde(fechaIso: string, hoy = new Date()) {
  const [a, m, d] = fechaIso.split("-").map(Number);
  let edad = hoy.getFullYear() - a;
  const cumpleAun = hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d);
  if (cumpleAun) edad -= 1;
  return edad;
}

// Iniciados 7-8 · Intermedios 9-10 · Avanzados 11-12
export function grupoPorEdad(edad: number) {
  if (edad <= 8) return "iniciados" as const;
  if (edad <= 10) return "intermedios" as const;
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
        user_metadata: { full_name: fila.nombre, phone: fila.telefono, rut: fila.rut },
      });
      if (error) {
        errores.push(`Apoderado ${email}: ${error.message}`);
        continue;
      }
      creadosApoderados += 1;
    }

    let creadosAlumnos = 0;
    let pagosIniciales = 0;
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
      const fechaNac = parseFechaNacimiento(fila.fecha_nacimiento);
      if (fila.fecha_nacimiento && !fechaNac) {
        errores.push(`Alumno ${fila.nombre}: fecha de nacimiento inválida (usa DD-MM-AAAA)`);
      }
      const edad = fechaNac ? edadDesde(fechaNac) : 8;
      const anio = fechaNac ? Number(fechaNac.slice(0, 4)) : new Date().getFullYear() - 8;
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
      const { data: creado, error } = await supabaseAdmin
        .from("players")
        .insert({
          name: fila.nombre,
          rut,
          birth_year: anio,
          birth_date: fechaNac,
          age_group: grupoPorEdad(edad),
          jersey_size: fila.talla_polera.toUpperCase() || null,
          medical_conditions: fila.condiciones_medicas || null,
          emergency_contact_name: fila.nombre_emergencia || null,
          emergency_contact_phone: fila.telefono_emergencia || null,
          emergency_relationship: fila.parentesco || null,
          training_day: fila.dia,
          parent_email: email,
          parent_id: parentId,
        })
        .select("id")
        .single();
      if (error) {
        errores.push(`Alumno ${fila.nombre}: ${error.message}`);
        continue;
      }
      creadosAlumnos += 1;

      if (creado && fila.monto_inicial != null) {
        const { error: errorPago } = await supabaseAdmin.from("payments").insert({
          player_id: creado.id,
          amount: fila.monto_inicial,
          concept: fila.concepto_inicial || "Mensualidad",
          status: "pending",
        });
        if (errorPago) errores.push(`Pago inicial de ${fila.nombre}: ${errorPago.message}`);
        else pagosIniciales += 1;
      }
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
      pagos: creadosPagos + pagosIniciales,
      errores,
    };
  });