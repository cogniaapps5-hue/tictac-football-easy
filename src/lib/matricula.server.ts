import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { edadDesde, grupoPorEdad, rutClaveTemporal } from "@/lib/carga-masiva-utils";
import type { EntradaMatricula, ResultadoMatricula } from "@/lib/matricula.schema";
import { urlSupabase } from "@/lib/supabase-config";

type AdminClient = SupabaseClient<Database>;

// Cliente privilegiado con la SERVICE ROLE KEY real del servidor.
// El cliente generado (client.server.ts) usa la clave publicable como
// respaldo, lo que provoca "This endpoint requires a valid Bearer token"
// en auth.admin.*. Aquí leemos la service role de verdad.
let _admin: AdminClient | null = null;
export function clienteAdmin(): AdminClient {
  if (_admin) return _admin;
  const clave =
    process.env["SUPABASE_SERVICE_ROLE_KEY"] ||
    process.env["SUPABASE_SECRET_KEY"] ||
    process.env["SUPABASE_SERVICE_KEY"];
  if (!clave) {
    throw new Error(
      "El servidor no tiene configurada la clave privilegiada (SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  const fetchConApikey: typeof fetch = (input, init) => {
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) new Headers(init.headers).forEach((v, k) => headers.set(k, v));
    if (
      (clave.startsWith("sb_secret_") || clave.startsWith("sb_publishable_")) &&
      headers.get("Authorization") === `Bearer ${clave}` &&
      !requestUrl.includes("/auth/v1/")
    ) {
      headers.delete("Authorization");
    }
    headers.set("apikey", clave);
    return fetch(input, { ...init, headers });
  };
  _admin = createClient<Database>(urlSupabase(), clave, {
    global: { fetch: fetchConApikey },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

type ErrorConCodigo = Error & { code?: string; details?: string; hint?: string };

function errorDetallado(error: unknown, contexto: string): ErrorConCodigo {
  const origen = error as { message?: string; code?: string; details?: string; hint?: string } | null;
  const codigo = origen?.code;
  let mensaje = origen?.message ?? "Error desconocido";

  if (codigo === "23505") mensaje = "Ya existe un alumno con ese RUT";
  else if (codigo === "23503") mensaje = "El apoderado relacionado no existe";
  else if (codigo === "42501" || mensaje.toLowerCase().includes("permission denied")) {
    mensaje = "La cuenta administradora no tiene permiso para completar esta operación";
  } else if (mensaje.toLowerCase().includes("row-level security")) {
    mensaje = "La política de seguridad bloqueó el registro del alumno";
  }

  const resultado = new Error(`${contexto}: ${mensaje}`) as ErrorConCodigo;
  resultado.code = codigo;
  resultado.details = origen?.details;
  resultado.hint = origen?.hint;
  return resultado;
}

function rutComparable(rut: string | null | undefined) {
  return (rut ?? "").replace(/[^0-9kK]/g, "").toUpperCase();
}

async function buscarUsuarioPorEmail(admin: AdminClient, email: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw errorDetallado(error, "No pudimos verificar la cuenta del apoderado");
    const usuario = data.users.find((item) => (item.email ?? "").toLowerCase() === email);
    if (usuario) return usuario;
    if (data.users.length < 1000) return null;
  }
  return null;
}

async function asegurarAdministrador(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin");
  if (error) throw errorDetallado(error, "No pudimos validar el rol administrador");
  if (!data?.length) throw new Error("Solo la administradora puede matricular alumnos");
}

export async function ejecutarMatricula(
  data: EntradaMatricula,
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ResultadoMatricula> {
  await asegurarAdministrador(supabase, userId);

  const clave = rutClaveTemporal(data.rut_alumno);
  if (clave.length < 6) throw new Error("El RUT del alumno debe tener al menos 6 dígitos");
  const hoy = new Date().toISOString().slice(0, 10);
  if (data.fecha_nacimiento > hoy) throw new Error("La fecha de nacimiento no puede ser futura");

  const supabaseAdmin = clienteAdmin();
  const email = data.email.trim().toLowerCase();
  const rutAlumno = rutComparable(data.rut_alumno);
  const { data: ruts, error: errorRuts } = await supabaseAdmin.from("players").select("id,rut");
  if (errorRuts) throw errorDetallado(errorRuts, "No pudimos verificar el RUT del alumno");
  if ((ruts ?? []).some((fila) => rutComparable(fila.rut) === rutAlumno)) {
    throw new Error("Ya existe un alumno con ese RUT");
  }

  const { data: perfil, error: errorPerfil } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (errorPerfil) throw errorDetallado(errorPerfil, "No pudimos verificar el perfil del apoderado");

  let parentId = perfil?.id ?? null;
  let nuevoUsuario = false;
  let usuarioCreadoId: string | null = null;

  try {
    if (!parentId) {
      const existente = await buscarUsuarioPorEmail(supabaseAdmin, email);
      if (existente) {
        parentId = existente.id;
      } else {
        const { data: creado, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: clave,
          email_confirm: true,
          user_metadata: {
            full_name: data.nombre_apoderado,
            phone: data.telefono,
            rut: data.rut_apoderado,
          },
        });
        if (error || !creado.user) {
          throw errorDetallado(error, "No pudimos crear la cuenta del apoderado");
        }
        parentId = creado.user.id;
        usuarioCreadoId = creado.user.id;
        nuevoUsuario = true;
      }
    }

    if (!parentId) throw new Error("No fue posible determinar la cuenta del apoderado");

    const { error: errorGuardarPerfil } = await supabaseAdmin.from("profiles").upsert(
      {
        id: parentId,
        email,
        full_name: data.nombre_apoderado,
        phone: data.telefono,
        must_change_password: nuevoUsuario,
      },
      { onConflict: "id" },
    );
    if (errorGuardarPerfil) {
      throw errorDetallado(errorGuardarPerfil, "No pudimos guardar el perfil del apoderado");
    }

    const { error: errorRol } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: parentId, role: "parent" }, { onConflict: "user_id,role" });
    if (errorRol) throw errorDetallado(errorRol, "No pudimos asignar el rol de apoderado");

    const { data: hermanosPrevios, error: errorHermanos } = await supabaseAdmin
      .from("players")
      .select("name")
      .eq("parent_id", parentId);
    if (errorHermanos) {
      throw errorDetallado(errorHermanos, "No pudimos verificar alumnos vinculados");
    }

    const edad = edadDesde(data.fecha_nacimiento);
    const { error: errorAlumno } = await supabaseAdmin.from("players").insert({
      name: data.nombre_alumno.trim(),
      rut: data.rut_alumno.trim(),
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
    if (errorAlumno) throw errorDetallado(errorAlumno, "No pudimos guardar al alumno");

    return {
      email,
      clave,
      nuevoUsuario,
      hermanos: (hermanosPrevios ?? []).map((hermano) => hermano.name),
    };
  } catch (error) {
    if (usuarioCreadoId) {
      const { error: errorLimpieza } = await supabaseAdmin.auth.admin.deleteUser(usuarioCreadoId);
    }
    throw error;
  }
}

