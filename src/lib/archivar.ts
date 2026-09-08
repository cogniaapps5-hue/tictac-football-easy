import { supabase } from "@/integrations/supabase/client";

/**
 * Eliminación definitiva de un alumno y todo su historial (pagos, asistencia,
 * avisos, recordatorios y sesiones de nutrición). Si el apoderado no conserva
 * otros hijos activos, su perfil queda inactivo para bloquear el ingreso.
 */
export async function archivarAlumno(playerId: string) {
  const { data: alumno, error: errorLectura } = await supabase
    .from("players")
    .select("id, parent_id")
    .eq("id", playerId)
    .maybeSingle();
  if (errorLectura || !alumno) throw errorLectura ?? new Error("Alumno no encontrado");

  const { error } = await supabase.rpc("eliminar_alumno", { _player_id: playerId });
  if (error) throw error;

  if (!alumno.parent_id) return { apoderadoBloqueado: false };

  const { data: hermanos } = await supabase
    .from("players")
    .select("id")
    .eq("parent_id", alumno.parent_id);

  if (hermanos && hermanos.length > 0) return { apoderadoBloqueado: false };

  const { error: errorPerfil } = await supabase
    .from("profiles")
    .update({ access_status: "inactive", archived_at: new Date().toISOString() })
    .eq("id", alumno.parent_id);
  if (errorPerfil) throw errorPerfil;
  return { apoderadoBloqueado: true };
}

/** Compatibilidad: ya no hay alumnos archivados, pero mantenemos la función
 * para no romper importaciones. Simplemente reactiva al apoderado si existía. */
export async function restablecerAlumno(playerId: string) {
  const { data: alumno } = await supabase
    .from("players")
    .select("id, parent_id")
    .eq("id", playerId)
    .maybeSingle();
  if (alumno?.parent_id) {
    await supabase
      .from("profiles")
      .update({ access_status: "active", archived_at: null })
      .eq("id", alumno.parent_id);
  }
  return { apoderadoReactivado: Boolean(alumno?.parent_id) };
}
