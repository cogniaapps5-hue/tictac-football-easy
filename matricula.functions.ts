import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { edadDesde, grupoPorEdad, rutClaveTemporal } from "@/lib/carga-masiva-utils";

const entrada = z.object({
  nombre_apoderado: z.string().trim().min(1).max(120),
  rut_apoderado: z.string().trim().min(1).max(20),
  email: z.string().trim().email().max(255),
  telefono: z.string().trim().min(1).max(40),
  nombre_alumno: z.string().trim().min(1).max(120),
  rut_alumno: z.string().trim().min(1).max(20),
  fecha_nacimiento: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  talla_polera: z.string().trim().max(20).default(""),
  condiciones_medicas: z.string().trim().max(1000).default(""),
  training_tuesday: z.boolean().default(true),
  training_thursday: z.boolean().default(false),
});

export type EntradaMatricula = z.input<typeof entrada>;
export type ResultadoMatricula = {
  email: string;
  clave: string;
  nuevoUsuario: boolean;
  hermanos: string[];
};

export const matricularAlumno = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => entrada.parse(data))
  .handler(async ({ data, context }): Promise<ResultadoMatricula> => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (!roles?.length) throw new Error("Solo la administradora puede matricular alumnos");

    const clave = rutClaveTemporal(data.rut_alumno);
    if (clave.length < 6) throw new Error("El RUT del alumno debe tener al menos 6 dígitos");

    const hoy = new Date().toISOString().slice(0, 10);
    if (data.fecha_nacimiento > hoy) throw new Error("Fecha de nacimiento inválida");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    const { data: rutExiste } = await supabaseAdmin
      .from("players")
      .select("id")
      .eq("rut", data.rut_alumno)
      .maybeSingle();
    if (rutExiste) throw new Error("Este RUT ya está matriculado");

    const { data: perfil } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    let parentId: string;
    let nuevoUsuario = false;

    if (perfil) {
      // El apoderado ya existe: reutilizamos su cuenta para sumar otro hijo.
      parentId = perfil.id;
      await supabaseAdmin
        .from("profiles")
        .update({ full_name: data.nombre_apoderado, phone: data.telefono })
        .eq("id", parentId);
    } else {
      const { data: creado, error: errorAuth } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: clave,
        email_confirm: true,
        user_metadata: {
          full_name: data.nombre_apoderado,
          phone: data.telefono,
          rut: data.rut_apoderado,
        },
      });
      if (errorAuth || !creado.user) {
        throw new Error("No pudimos crear la cuenta del apoderado. Intenta nuevamente.");
      }
      parentId = creado.user.id;
      nuevoUsuario = true;

      await supabaseAdmin.from("profiles").upsert(
        {
          id: parentId,
          email,
          full_name: data.nombre_apoderado,
          phone: data.telefono,
          must_change_password: true,
        },
        { onConflict: "id" },
      );
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: parentId, role: "parent" }, { onConflict: "user_id,role" });
    }

    const { data: hermanosPrevios } = await supabaseAdmin
      .from("players")
      .select("name")
      .eq("parent_id", parentId);

    const edad = edadDesde(data.fecha_nacimiento);
    const { error } = await supabaseAdmin.from("players").insert({
      name: data.nombre_alumno,
      rut: data.rut_alumno,
      birth_date: data.fecha_nacimiento,
      birth_year: Number(data.fecha_nacimiento.slice(0, 4)),
      age_group: grupoPorEdad(edad),
      jersey_size: data.talla_polera || null,
      medical_conditions: data.condiciones_medicas || "Ninguna",
      training_day: data.training_tuesday ? "martes" : "jueves",
      training_tuesday: data.training_tuesday,
      training_thursday: data.training_thursday,
      parent_email: email,
      parent_id: parentId,
      access_status: "active",
    });
    if (error) throw new Error("No pudimos guardar al alumno. Intenta nuevamente.");

    return {
      email,
      clave,
      nuevoUsuario,
      hermanos: (hermanosPrevios ?? []).map((h) => h.name),
    };
  });