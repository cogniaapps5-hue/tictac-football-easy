import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useSesion } from "@/lib/session";

/** Estilo del banner destacado según la categoría del aviso. */
export function estiloAviso(categoria: string | null | undefined) {
  switch (categoria) {
    case "suspension":
      return {
        emoji: "🌧️",
        etiqueta: "Suspensión",
        clase: "border-danger bg-danger/20",
        texto: "text-danger",
      };
    case "informacion_importante":
      return {
        emoji: "📢",
        etiqueta: "Información Importante",
        clase: "border-gold-brand bg-gold-brand/20",
        texto: "text-gold-brand",
      };
    case "partido_amistoso":
      return {
        emoji: "⚽",
        etiqueta: "Partido Amistoso",
        clase: "border-cyan-brand bg-cyan-brand/20",
        texto: "text-cyan-brand",
      };
    case "entrenamiento":
      return {
        emoji: "🏃",
        etiqueta: "Entrenamiento",
        clase: "border-success bg-success/20",
        texto: "text-success",
      };
    default:
      return {
        emoji: "📝",
        etiqueta: "Aviso",
        clase: "border-border bg-secondary",
        texto: "text-muted-foreground",
      };
  }
}

export function esDeHoy(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}

/** Ordena: primero suspensiones de hoy, luego por fecha descendente. */
export function ordenarAvisos<T extends { category: string; created_at: string }>(avisos: T[]) {
  return [...avisos].sort((a, b) => {
    const pa = a.category === "suspension" && esDeHoy(a.created_at) ? 0 : 1;
    const pb = b.category === "suspension" && esDeHoy(b.created_at) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

const CLAVE = "tictac:avisos-vistos:";

export function leerVistoAvisos(userId: string) {
  if (typeof window === "undefined") return 0;
  const guardado = window.localStorage.getItem(CLAVE + userId);
  return guardado ? Number(guardado) || 0 : 0;
}

export function marcarAvisosVistos(userId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLAVE + userId, String(Date.now()));
}

export function useAvisos() {
  return useQuery({
    queryKey: ["avisos-padre"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notices")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Cantidad de avisos creados después de la última vez que abrió la sección. */
export function useAvisosNoLeidos() {
  const { data: sesion } = useSesion();
  const { data: avisos } = useAvisos();
  if (!sesion || !avisos) return 0;
  const visto = leerVistoAvisos(sesion.userId);
  return avisos.filter((a) => new Date(a.created_at).getTime() > visto).length;
}
