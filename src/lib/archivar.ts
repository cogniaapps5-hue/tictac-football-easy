import { supabase } from "@/integrations/supabase/client";
import { eliminarAlumnoTotal } from "@/lib/eliminar-alumno.functions";

/**
 * Eliminación definitiva de un alumno y todo su historial (pagos, asistencia,
 * avisos, recordatorios y nutrición). Si el apoderado no conserva otros hijos,
 * también se borran su perfil y su cuenta de acceso, para poder re-matricular
 * sin conflictos.
 */
export async function archivarAlumno(playerId: string) {
  const resultado = await eliminarAlumnoTotal({ data: { playerId } });
  return { apoderadoBloqueado: resultado.apoderadoEliminado };
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
