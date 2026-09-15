import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ResultadoEliminacion = {
  alumno: string;
  apoderadoEliminado: boolean;
};

/**
 * Borrado definitivo de un alumno: elimina su ficha y todo su historial
 * (asistencia, pagos, avisos, recordatorios, nutrición). Si el apoderado no
 * conserva otros hijos, también se elimina su perfil, su rol y su cuenta de
 * acceso, de modo que se pueda volver a matricular sin conflictos.
 */
export const eliminarAlumnoTotal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ playerId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<ResultadoEliminacion> => {
    const clave = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const url = process.env["SUPABASE_URL"];
    if (!clave || !url) throw new Error("El servidor no tiene configurada la clave privilegiada.");

    const { data: esAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!esAdmin) throw new Error("Solo la administradora puede eliminar alumnos.");

    const admin = createClient(url, clave, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (clave.startsWith("sb_") && h.get("Authorization") === `Bearer ${clave}`) {
            h.delete("Authorization");
          }
          h.set("apikey", clave);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: alumno, error: errorLectura } = await admin
      .from("players")
      .select("id, name, parent_id, parent_email")
      .eq("id", data.playerId)
      .maybeSingle();
    if (errorLectura) throw errorLectura;
    if (!alumno) throw new Error("Alumno no encontrado");

    // 1. Historial relacionado
    for (const tabla of [
      "attendance",
      "notifications",
      "payment_reminders",
      "nutrition_sessions",
      "payments",
    ] as const) {
      const { error } = await admin.from(tabla).delete().eq("player_id", alumno.id);
      if (error) throw error;
    }

    // 2. Ficha del alumno
    const { error: errorAlumno } = await admin.from("players").delete().eq("id", alumno.id);
    if (errorAlumno) throw errorAlumno;

    // 3. Apoderado sin otros hijos → se elimina por completo
    let apoderadoEliminado = false;
    const parentId = alumno.parent_id;
    if (parentId) {
      const { data: hermanos } = await admin.from("players").select("id").eq("parent_id", parentId);
      if (!hermanos || hermanos.length === 0) {
        await admin.from("user_roles").delete().eq("user_id", parentId);
        await admin.from("profiles").delete().eq("id", parentId);
        const { error: errorAuth } = await admin.auth.admin.deleteUser(parentId);
        if (errorAuth) console.error("No se pudo borrar la cuenta de acceso:", errorAuth);
        apoderadoEliminado = true;
      }
    } else if (alumno.parent_email) {
      // Sin cuenta vinculada: limpiamos fichas huérfanas con el mismo correo
      const { data: hermanos } = await admin
        .from("players")
        .select("id")
        .eq("parent_email", alumno.parent_email);
      if (!hermanos || hermanos.length === 0) {
        await admin.from("profiles").delete().eq("email", alumno.parent_email);
        apoderadoEliminado = true;
      }
    }

    return { alumno: alumno.name, apoderadoEliminado };
  });
