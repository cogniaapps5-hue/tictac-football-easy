import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Rol = "admin" | "parent";

export function useSesion() {
  return useQuery({
    queryKey: ["sesion"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return null;
      const [{ data: perfil }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const rol: Rol = roles?.some((r) => r.role === "admin") ? "admin" : "parent";
      return {
        userId: user.id,
        email: user.email ?? "",
        nombre: perfil?.full_name || user.email?.split("@")[0] || "",
        telefono: perfil?.phone ?? "",
        rol,
      };
    },
  });
}

export function saludo() {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

const formatoCLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export function pesos(valor: number) {
  return formatoCLP.format(valor).replace(/\s/g, "");
}

export function fechaCorta(iso: string) {
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  return d.toLocaleDateString("es-CL", { day: "numeric", month: "short" });
}

export function proximoEntrenamiento() {
  const hoy = new Date();
  const dia = hoy.getDay();
  const faltan = (3 - dia + 7) % 7 || 7;
  const fecha = new Date(hoy);
  fecha.setDate(hoy.getDate() + faltan);
  return {
    fecha,
    iso: fecha.toISOString().slice(0, 10),
    texto: fecha.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }),
  };
}