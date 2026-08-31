import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { edadDesde, grupoPorEdad, rutClaveTemporal } from "@/lib/carga-masiva-utils";
import type {
  EntradaMatricula,
  ResultadoMatricula,
  ResultadoTestMatricula,
} from "@/lib/matricula.schema";

type AdminClient = SupabaseClient<Database>;

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
  const registroId = crypto.randomUUID();
  console.info(`[REGISTRO ${registroId}] Paso 1/7: solicitud recibida y validada`);
  await asegurarAdministrador(supabase, userId);
  console.info(`[REGISTRO ${registroId}] Paso 2/7: rol administrador verificado`);

  const clave = rutClaveTemporal(data.rut_alumno);
  if (clave.length < 6) throw new Error("El RUT del alumno debe tener al menos 6 dígitos");
  const hoy = new Date().toISOString().slice(0, 10);
  if (data.fecha_nacimiento > hoy) throw new Error("La fecha de nacimiento no puede ser futura");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const email = data.email.trim().toLowerCase();
  const rutAlumno = rutComparable(data.rut_alumno);
  const { data: ruts, error: errorRuts } = await supabaseAdmin.from("players").select("id,rut");
  if (errorRuts) throw errorDetallado(errorRuts, "No pudimos verificar el RUT del alumno");
  if ((ruts ?? []).some((fila) => rutComparable(fila.rut) === rutAlumno)) {
    throw new Error("Ya existe un alumno con ese RUT");
  }
  console.info(`[REGISTRO ${registroId}] Paso 3/7: RUT disponible`);

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
        console.info(`[REGISTRO ${registroId}] Paso 4/7: cuenta existente recuperada`);
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
        console.info(`[REGISTRO ${registroId}] Paso 4/7: cuenta del apoderado creada`);
      }
    } else {
      console.info(`[REGISTRO ${registroId}] Paso 4/7: perfil existente reutilizado`);
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
    console.info(`[REGISTRO ${registroId}] Paso 5/7: perfil y rol vinculados`);

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

    console.info(`[REGISTRO ${registroId}] Paso 6/7: alumno guardado`);
    console.info(`[REGISTRO ${registroId}] Paso 7/7: matrícula completada`);
    return {
      email,
      clave,
      nuevoUsuario,
      hermanos: (hermanosPrevios ?? []).map((hermano) => hermano.name),
    };
  } catch (error) {
    console.error(`[REGISTRO ${registroId}] Falló el proceso`, {
      message: error instanceof Error ? error.message : "Error desconocido",
      code: (error as ErrorConCodigo | null)?.code,
    });
    if (usuarioCreadoId) {
      const { error: errorLimpieza } = await supabaseAdmin.auth.admin.deleteUser(usuarioCreadoId);
      console.info(
        `[REGISTRO ${registroId}] Limpieza de cuenta parcial: ${errorLimpieza ? "falló" : "completada"}`,
      );
    }
    throw error;
  }
}

export async function ejecutarTestMatricula(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<ResultadoTestMatricula> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const marca = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `test-registro-${marca}@tictac.test`;
  const rut = `99${marca.slice(-6)}-${Math.floor(Math.random() * 9)}`;
  let usuarioId: string | null = null;
  let alumnoId: string | null = null;
  const etapas: string[] = [];

  console.info("[TEST REGISTRO] Paso 1/4: iniciando flujo real de matrícula");
  try {
    const resultado = await ejecutarMatricula(
      {
        nombre_apoderado: "Apoderado Test Registro",
        rut_apoderado: rut,
        email,
        telefono: "+56900000000",
        nombre_alumno: `TEST ALUMNO ${marca}`,
        rut_alumno: rut,
        fecha_nacimiento: "2018-01-01",
        talla_polera: "M",
        condiciones_medicas: "Ninguna",
        training_tuesday: true,
        training_thursday: false,
      },
      supabase,
      userId,
    );
    if (!resultado.nuevoUsuario) {
      throw new Error("Test: el flujo no creó la cuenta temporal esperada");
    }
    etapas.push("Flujo real completado");

    const { data: usuario, error: errorUsuario } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (errorUsuario) throw errorDetallado(errorUsuario, "Test: verificación de cuenta");
    usuarioId = usuario.users.find((item) => (item.email ?? "").toLowerCase() === email)?.id ?? null;
    if (!usuarioId) throw new Error("Test: la cuenta creada no pudo verificarse");
    etapas.push("Cuenta verificada");

    const { data: alumno, error: errorAlumno } = await supabaseAdmin
      .from("players")
      .select("id")
      .eq("rut", rut)
      .single();
    if (errorAlumno || !alumno) throw errorDetallado(errorAlumno, "Test: verificación de alumno");
    alumnoId = alumno.id;
    etapas.push("Alumno verificado");
    console.info("[TEST REGISTRO] Paso 2/4: cuenta, perfil, rol y alumno verificados");

    const { error: errorBorrarAlumno } = await supabaseAdmin.from("players").delete().eq("id", alumnoId);
    if (errorBorrarAlumno) throw errorDetallado(errorBorrarAlumno, "Test: eliminación de alumno");
    alumnoId = null;
    etapas.push("Alumno eliminado");

    const { error: errorBorrarUsuario } = await supabaseAdmin.auth.admin.deleteUser(usuarioId);
    if (errorBorrarUsuario) throw errorDetallado(errorBorrarUsuario, "Test: eliminación de cuenta");
    usuarioId = null;
    etapas.push("Cuenta de prueba eliminada");
    console.info("[TEST REGISTRO] Paso 3/4: datos de prueba eliminados");
    console.info("[TEST REGISTRO] Paso 4/4: prueba del flujo real completada");
    return { ok: true, mensaje: "✅ TEST EXITOSO", etapas };
  } catch (error) {
    console.error("[TEST REGISTRO] Falló", {
      message: error instanceof Error ? error.message : "Error desconocido",
      code: (error as ErrorConCodigo | null)?.code,
    });
    if (!usuarioId) {
      const { data: usuarios } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      usuarioId = usuarios?.users.find((item) => (item.email ?? "").toLowerCase() === email)?.id ?? null;
    }
    if (!alumnoId) {
      const { data: alumno } = await supabaseAdmin
        .from("players")
        .select("id")
        .eq("rut", rut)
        .maybeSingle();
      alumnoId = alumno?.id ?? null;
    }
    if (alumnoId) await supabaseAdmin.from("players").delete().eq("id", alumnoId);
    if (usuarioId) await supabaseAdmin.auth.admin.deleteUser(usuarioId);
    throw error;
  }
}