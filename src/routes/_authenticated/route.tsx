import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/" });
    const [{ data: perfil }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("must_change_password")
        .eq("id", data.user.id)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", data.user.id),
    ]);
    if (!perfil || !roles?.length) throw redirect({ to: "/error-acceso" });
    if (perfil?.must_change_password) throw redirect({ to: "/cambiar-clave" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});