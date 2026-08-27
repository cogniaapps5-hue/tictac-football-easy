import { supabase } from "@/integrations/supabase/client";

/**
 * Baja lógica (soft delete) de un alumno: nunca borra filas, sólo marca el
 * acceso como "inactive" y guarda la fecha. El historial de pagos y
 * asistencia queda intacto para los reportes.
 *
 * Además, si el apoderado no conserva otros hijos activos, su perfil también
 * queda inactivo para bloquear el ingreso a la app.
 */
export async function archivarAlumno(playerId: string) {
  const { data: alumno, error: errorLectura } = await supabase
    .from("players")
    .select("id, parent_id, parent_email")
    .eq("id", playerId)
    .maybeSingle();
  if (errorLectura || !alumno) throw errorLectura ?? new Error("Alumno no encontrado");

  const { error } = await supabase
    .from("players")
    .update({ access_status: "inactive", archived_at: new Date().toISOString() })
    .eq("id", playerId);
  if (error) throw error;

  if (!alumno.parent_id) return { apoderadoBloqueado: false };

  const { data: hermanos } = await supabase
    .from("players")
    .select("id")
    .eq("parent_id", alumno.parent_id)
    .neq("id", playerId)
    .neq("access_status", "inactive");

  if (hermanos && hermanos.length > 0) return { apoderadoBloqueado: false };

  const { error: errorPerfil } = await supabase
    .from("profiles")
    .update({ access_status: "inactive", archived_at: new Date().toISOString() })
    .eq("id", alumno.parent_id);
  if (errorPerfil) throw errorPerfil;
  return { apoderadoBloqueado: true };
}

/** Reactiva a un alumno archivado (y reactiva la cuenta de su apoderado). */
export async function restablecerAlumno(playerId: string) {
  const { data: alumno, error: errorLectura } = await supabase
    .from("players")
    .select("id, parent_id")
    .eq("id", playerId)
    .maybeSingle();
  if (errorLectura || !alumno) throw errorLectura ?? new Error("Alumno no encontrado");

  const { error } = await supabase
    .from("players")
    .update({ access_status: "active", archived_at: null })
    .eq("id", playerId);
  if (error) throw error;

  if (alumno.parent_id) {
    await supabase
      .from("profiles")
      .update({ access_status: "active", archived_at: null })
      .eq("id", alumno.parent_id);
  }
  return { apoderadoReactivado: Boolean(alumno.parent_id) };
}
