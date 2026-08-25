import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { limpiarSesion, sesionValida } from "@/lib/sesion";
import { PantallaCargando, PantallaError } from "@/components/tictac/Estados";
import { accesoSuspendido } from "@/lib/suscripcion";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Sesión real y token vigente: sin eso siempre vuelve al login.
    const sesion = await sesionValida();
    const user = sesion?.user;
    if (!user) throw redirect({ to: "/" });
    const [perfilRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("id").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    // Si la consulta falló por red, dejamos pasar: las vistas ya manejan datos vacíos.
    if (perfilRes.error || rolesRes.error) return { user };
    if (!perfilRes.data) {
      // Perfil inexistente: estado corrupto, se limpia y vuelve al login.
      await limpiarSesion();
      throw redirect({ to: "/" });
    }
    if (!rolesRes.data?.length) throw redirect({ to: "/error-acceso" });
    // Suscripción suspendida: la escuela no entra a la app hasta reactivarla.
    if (await accesoSuspendido(user.id, user.email))
      throw redirect({ to: "/servicio-suspendido" });
    // Sin redirección forzada a "/cambiar-clave": el cambio de clave es opcional.
    return { user };
  },
  component: () => <Outlet />,
  pendingMs: 0,
  pendingComponent: () => <PantallaCargando texto="Entrando…" />,
  errorComponent: ({ error }) => (
    <PantallaError detalle={error instanceof Error ? error.message : undefined} />
  ),
});