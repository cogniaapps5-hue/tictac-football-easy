import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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

/**
 * Saludo según la hora del reloj del usuario. Se calcula después de hidratar
 * (el servidor está en UTC) y se refresca cada minuto para que cambie solo.
 */
export function useSaludo() {
  const [texto, setTexto] = useState("Hola");
  useEffect(() => {
    const actualizar = () => setTexto(saludo());
    actualizar();
    const id = setInterval(actualizar, 60_000);
    return () => clearInterval(id);
  }, []);
  return texto;
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

export type GrupoEtario = "iniciados" | "intermedios" | "avanzados";
export type DiaEntrenamiento = "martes" | "jueves";

/** Horarios y sedes fijas de la escuela. */
export const SEDES: {
  valor: DiaEntrenamiento;
  corto: string;
  largo: string;
  diaSemana: number;
  hora: string;
  sede: string;
}[] = [
  { valor: "martes", corto: "Mar", largo: "Martes", diaSemana: 2, hora: "19:00", sede: "Rancho Rossi Peñuelas" },
  { valor: "jueves", corto: "Jue", largo: "Jueves", diaSemana: 4, hora: "19:00", sede: "Forza Club Sindempart" },
];

export function sedeDe(dia: string | null | undefined) {
  return SEDES.find((s) => s.valor === dia) ?? SEDES[0];
}

/**
 * Próxima sesión. Si se entrega un día (martes/jueves) calcula la próxima de
 * ese día; si no, la más cercana de las dos.
 */
export function proximoEntrenamiento(dia?: string | null) {
  const hoy = new Date();
  const candidatos = (dia ? [sedeDe(dia)] : SEDES).map((slot) => {
    const faltan = (slot.diaSemana - hoy.getDay() + 7) % 7;
    const fecha = new Date(hoy);
    fecha.setDate(hoy.getDate() + faltan);
    return { slot, fecha, faltan };
  });
  candidatos.sort((a, b) => a.faltan - b.faltan);
  const elegido = candidatos[0];
  const { slot, fecha } = elegido;
  return {
    fecha,
    slot,
    iso: `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`,
    dia: slot.valor,
    hora: slot.hora,
    sede: slot.sede,
    titulo: `${slot.largo} ${slot.hora} hrs`,
    texto: fecha.toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" }),
  };
}

export const GRUPOS: { valor: GrupoEtario; etiqueta: string; emoji: string; color: string }[] = [
  { valor: "iniciados", etiqueta: "Grupo 1 (7-8)", emoji: "🟢", color: "text-success" },
  { valor: "intermedios", etiqueta: "Grupo 2 (9-10)", emoji: "🟡", color: "text-gold-brand" },
  { valor: "avanzados", etiqueta: "Grupo 3 (11-12)", emoji: "🔵", color: "text-cyan-brand" },
];

export const DIAS = SEDES;

export function grupoEtiqueta(grupo: string) {
  return GRUPOS.find((g) => g.valor === grupo)?.etiqueta ?? grupo;
}

/** Nombre corto del grupo, sin el rango de edad. Ej: "Grupo 1". */
export function grupoCorto(grupo: string) {
  return grupoEtiqueta(grupo).replace(/\s*\(.*\)$/, "");
}

export function grupoPorAnio(anio: number): GrupoEtario {
  if (anio >= 2018) return "iniciados";
  if (anio >= 2016) return "intermedios";
  return "avanzados";
}

/**
 * Categorías de avisos. TIC TAC es una escuela formativa: no hay torneos ni
 * reuniones de competencia, sí partidos amistosos e información importante.
 */
export const CATEGORIAS_AVISO: {
  valor: string;
  etiqueta: string;
  emoji: string;
  clase: string;
}[] = [
  {
    valor: "partido_amistoso",
    etiqueta: "Partido Amistoso",
    emoji: "⚽",
    clase: "bg-success/20 text-success",
  },
  {
    valor: "informacion_importante",
    etiqueta: "Información Importante",
    emoji: "📢",
    clase: "bg-gold-brand/25 text-gold-brand",
  },
  {
    valor: "entrenamiento",
    etiqueta: "Entrenamiento",
    emoji: "🏃",
    clase: "bg-cyan-brand/20 text-cyan-brand",
  },
  {
    valor: "suspension",
    etiqueta: "Suspensión",
    emoji: "🌧️",
    clase: "bg-danger/20 text-danger",
  },
  { valor: "otro", etiqueta: "Otro", emoji: "📝", clase: "bg-secondary text-muted-foreground" },
];

export function categoriaAviso(valor: string | null | undefined) {
  return CATEGORIAS_AVISO.find((c) => c.valor === valor) ?? CATEGORIAS_AVISO[4];
}
