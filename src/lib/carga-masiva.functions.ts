import { createServerFn } from "@tanstack/react-start";
import { leerSecretoServidor } from "@/lib/runtime-env.server";
import { z } from "zod";
import { exigirAuthSupabase } from "@/lib/auth-middleware.server";
import {
  parseFechaNacimiento,
  edadDesde,
  grupoPorEdad,
  rutClaveTemporal,
  normalizarCondicion,
} from "@/lib/carga-masiva-utils";

const fila = z.object({
  nombre_apoderado: z.string().trim().max(120).default(""),
  rut_apoderado: z.string().trim().max(20).default(""),
  email: z.string().trim().max(255).default(""),
  telefono: z.string().trim().max(40).default(""),
  nombre_alumno: z.string().trim().min(1).max(120),
  rut_alumno: z.string().trim().max(20).default(""),
  fecha_nacimiento: z.string().trim().max(20).default(""),
  talla_polera: z.string().trim().max(40).default(""),
  condiciones_medicas: z.string().trim().max(1000).default(""),
  dia_entrenamiento: z.enum(["martes", "jueves"]).default("martes"),
  training_tuesday: z.boolean().default(true),
  training_thursday: z.boolean().default(false),
});

const entrada = z.object({ filas: z.array(fila).max(500).default([]) });

export type FilaCarga = z.input<typeof fila>;
export type EntradaCarga = z.input<typeof entrada>;

export type ResultadoCarga = {
  apoderados: number;
  alumnos: number;
  errores: string[];
};

export const MENSAJE_WHATSAPP =
  "Hola apoderados 🌟. Sus cuentas en la App TIC TAC están listas. Usuario: su correo. Contraseña temporal: El RUT de su hijo (sin puntos ni guión). Al entrar, deberán crear su propia clave.";

export const cargaMasiva = createServerFn({ method: "POST" })
  .middleware([exigirAuthSupabase])
  .inputValidator((data: unknown) => entrada.parse(data))
  .handler(async ({ data, context }): Promise<ResultadoCarga> => {
    const { supabase, userId } = context;
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin");
    if (!roles?.length) throw new Error("Solo la administradora puede cargar datos");

    const clavePrivilegiada = leerSecretoServidor("SUPABASE_SERVICE_ROLE_KEY");
    if (!clavePrivilegiada) {
      throw new Error("El servicio de carga masiva no está disponible temporalmente");
    }
    const { clienteAdmin } = await import("@/lib/matricula.server");
    const supabaseAdmin = clienteAdmin(clavePrivilegiada);
    const errores: string[] = [];
    let creadosApoderados = 0;
    let creadosAlumnos = 0;

    for (const f of data.filas) {
      const email = f.email.trim().toLowerCase();
      let parentId: string | null = null;

      if (email) {
        const { data: perfil } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", email)
          .maybeSingle();
        if (perfil) {
          parentId = perfil.id;
          await supabaseAdmin
            .from("profiles")
            .update({
              full_name: f.nombre_apoderado || undefined,
              phone: f.telefono || undefined,
            })
            .eq("id", perfil.id);
        } else {
          const clave = rutClaveTemporal(f.rut_alumno);
          if (clave.length < 6) {
            errores.push(
              `Apoderado ${email}: el RUT del alumno (${f.rut_alumno || "vacío"}) no sirve como clave temporal (mínimo 6 dígitos)`,
            );
          } else {
          const { data: creado, error } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: clave,
            email_confirm: true,
            user_metadata: {
              full_name: f.nombre_apoderado,
              phone: f.telefono,
              rut: f.rut_apoderado,
            },
          });
          if (error) errores.push(`Apoderado ${email}: ${error.message}`);
          else {
            parentId = creado.user?.id ?? null;
            creadosApoderados += 1;
            if (parentId) {
              await supabaseAdmin.from("profiles").upsert(
                {
                  id: parentId,
                  email,
                  full_name: f.nombre_apoderado || email.split("@")[0]!,
                  phone: f.telefono || null,
                  must_change_password: true,
                },
                { onConflict: "id" },
              );
              await supabaseAdmin
                .from("user_roles")
                .upsert({ user_id: parentId, role: "parent" }, { onConflict: "user_id,role" });
            }
          }
          }
        }
      }

      const fechaNac = parseFechaNacimiento(f.fecha_nacimiento);
      if (f.fecha_nacimiento && !fechaNac) {
        errores.push(`Alumno ${f.nombre_alumno}: fecha de nacimiento inválida (usa DD-MM-AAAA)`);
      }
      const edad = fechaNac ? edadDesde(fechaNac) : 8;
      const anio = fechaNac ? Number(fechaNac.slice(0, 4)) : new Date().getFullYear() - 8;
      const rut = f.rut_alumno || null;

      if (rut) {
        const { data: yaExiste } = await supabaseAdmin
          .from("players")
          .select("id")
          .eq("rut", rut)
          .maybeSingle();
        if (yaExiste) {
          errores.push(`Alumno ${f.nombre_alumno} (RUT ${rut}): ya estaba registrado`);
          continue;
        }
      }

      const { error } = await supabaseAdmin.from("players").insert({
        name: f.nombre_alumno,
        rut,
        birth_year: anio,
        birth_date: fechaNac,
        age_group: grupoPorEdad(edad),
        jersey_size: f.talla_polera.toUpperCase() || null,
        medical_conditions: normalizarCondicion(f.condiciones_medicas),
        training_day: f.training_tuesday ? "martes" : "jueves",
        training_tuesday: f.training_tuesday,
        training_thursday: f.training_thursday,
        parent_email: email || null,
        parent_id: parentId,
      });
      if (error) {
        errores.push(`Alumno ${f.nombre_alumno}: ${error.message}`);
        continue;
      }
      creadosAlumnos += 1;
    }

    return { apoderados: creadosApoderados, alumnos: creadosAlumnos, errores };
  });
