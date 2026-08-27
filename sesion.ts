import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

/** Borra sesión y cualquier dato local corrupto. */
export async function limpiarSesion() {
  try {
    await supabase.auth.signOut();
  } catch {
    // Si falla la red igual limpiamos lo local.
  }
  if (typeof window !== "undefined") {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // Modo privado o storage bloqueado: no es crítico.
    }
  }
}

/**
 * Devuelve la sesión solo si es real y su token no está vencido.
 * Cualquier otro caso limpia el estado local para evitar ingresos sin clave.
 */
export async function sesionValida(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  const sesion = data?.session ?? null;
  if (error || !sesion?.access_token || !sesion.user) {
    await limpiarSesion();
    return null;
  }
  const ahora = Math.floor(Date.now() / 1000);
  if (sesion.expires_at && sesion.expires_at <= ahora) {
    const { data: refrescada } = await supabase.auth.refreshSession();
    if (!refrescada?.session) {
      await limpiarSesion();
      return null;
    }
    return refrescada.session;
  }
  return sesion;
}
