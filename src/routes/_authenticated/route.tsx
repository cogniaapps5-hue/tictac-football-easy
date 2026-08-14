import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Solo la sesión local decide si sigue dentro: un problema momentáneo de
    // red (por ejemplo al volver de la cámara) no debe cerrar la sesión.
    const { data: sesion } = await supabase.auth.getSession();
    const user = sesion.session?.user;
    if (!user) throw redirect({ to: "/" });
    const [perfilRes, rolesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    // Si la consulta falló por red, dejamos pasar: las vistas ya manejan datos vacíos.
    if (perfilRes.error || rolesRes.error) return { user };
    if (!perfilRes.data || !rolesRes.data?.length) throw redirect({ to: "/error-acceso" });
    if (perfilRes.data.must_change_password) throw redirect({ to: "/cambiar-clave" });
    return { user };
  },
  component: () => <Outlet />,
});