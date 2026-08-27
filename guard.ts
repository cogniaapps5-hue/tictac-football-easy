import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { Rol } from "@/lib/session";
import { sesionValida } from "@/lib/sesion";

/** Rol real del usuario autenticado (null si no hay sesión o no tiene rol). */
export async function rolActual(): Promise<Rol | null | "desconocido"> {
  const user = (await sesionValida())?.user;
  if (!user) return null;
  const { data: roles, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);
  // Falla de red: no sabemos el rol, pero tampoco cerramos la sesión.
  if (error) return "desconocido";
  if (!roles?.length) return null;
  return roles.some((r) => r.role === "admin") ? "admin" : "parent";
}

/**
 * Guard de rol para rutas protegidas. Si el rol no coincide, devuelve al
 * usuario a su propio inicio en vez de mostrar contenido ajeno.
 */
export function exigirRol(rol: Rol) {
  return async () => {
    const actual = await rolActual();
    if (actual === "desconocido") return;
    if (!actual) throw redirect({ to: "/error-acceso" });
    if (actual !== rol) throw redirect({ to: "/inicio" });
  };
}
