import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { matriculaSchema, type ResultadoMatricula } from "@/lib/matricula.schema";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function edadDesde(fecha: string): number {
  const nac = new Date(`${fecha}T12:00:00`);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad -= 1;
  return edad;
}

function grupoPorEdad(edad: number): "iniciados" | "intermedios" | "avanzados" {
  if (edad <= 8) return "iniciados";
  if (edad <= 10) return "intermedios";
  return "avanzados";
}

export const matriculaEmergencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => matriculaSchema.parse(data))
  .handler(async ({ data, context }): Promise<ResultadoMatricula> => {
    // Leer la clave privilegiada DENTRO del handler (no al cargar el módulo)
    const clave = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const url = process.env["SUPABASE_URL"];
    if (!clave || !url) {
      throw new Error("El servidor no tiene configurada la clave privilegiada.");
    }

    // Verificar que quien llama es administradora
    const { data: esAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!esAdmin) throw new Error("Solo la administradora puede matricular.");

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

    const email = data.email.trim().toLowerCase();
    const claveTemporal = data.rut_alumno.replace(/\D/g, "").slice(-8) || "Tictac2026";

    try {
      // 1. Buscar o crear usuario en Auth
      let userId: string | null = null;
      let nuevoUsuario = true;

      const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });
      const existente = lista?.users?.find((u) => u.email?.toLowerCase() === email);
      if (existente) {
        userId = existente.id;
        nuevoUsuario = false;
      } else {
        const { data: creado, error: errorAuth } = await admin.auth.admin.createUser({
          email,
          password: claveTemporal,
          email_confirm: true,
          user_metadata: { full_name: data.nombre_apoderado, phone: data.telefono },
        });
        if (errorAuth || !creado.user) {
          throw new Error("No se pudo crear la cuenta del apoderado");
        }
        userId = creado.user.id;
      }

      // 2. Perfil
      const { error: errorProfile } = await admin.from("profiles").upsert({
        id: userId,
        email,
        full_name: data.nombre_apoderado.trim(),
        phone: data.telefono.trim(),
        must_change_password: nuevoUsuario,
      });
      if (errorProfile) throw errorProfile;

      // 3. Rol de apoderado
      const { error: errorRol } = await admin
        .from("user_roles")
        .upsert({ user_id: userId, role: "parent" }, { onConflict: "user_id,role" });
      if (errorRol) throw errorRol;

      // 4. Hermanos (mismo apoderado)
      const { data: hermanosRows } = await admin
        .from("players")
        .select("name")
        .eq("parent_id", userId);
      const hermanos = (hermanosRows ?? []).map((h) => h.name);

      // 5. Alumno
      const edad = edadDesde(data.fecha_nacimiento);
      const { error: errorAlumno } = await admin.from("players").insert({
        name: data.nombre_alumno.trim(),
        rut: data.rut_alumno.trim(),
        birth_date: data.fecha_nacimiento,
        birth_year: Number(data.fecha_nacimiento.slice(0, 4)),
        age_group: grupoPorEdad(edad),
        jersey_size: data.talla_polera || null,
        medical_conditions: data.condiciones_medicas || null,
        training_tuesday: data.training_tuesday,
        training_thursday: data.training_thursday,
        training_day: data.training_tuesday ? "martes" : "jueves",
        parent_email: email,
        parent_id: userId,
        access_status: "active",
      });
      if (errorAlumno) throw errorAlumno;

      return { email, clave: claveTemporal, nuevoUsuario, hermanos };
    } catch (error) {
      console.error("Error en matrícula emergencia:", error);
      throw new Error(
        `Matrícula fallida: ${error instanceof Error ? error.message : "Error desconocido"}`,
      );
    }
  });
