import { supabase } from "@/integrations/supabase/client";

/** Correos con acceso al panel de suscripciones (dueño de la app). */
export const SUPER_ADMINS = ["emilioapps5@gmail.com", "emilio@tictac.cl"];

export const CONTACTO_SUSCRIPCION = "emilio@tictac.cl";
export const MONTO_SUSCRIPCION = 30000;

export function esSuperAdmin(email: string | null | undefined) {
  return !!email && SUPER_ADMINS.includes(email.trim().toLowerCase());
}

export type EstadoSuscripcion = "active" | "past_due" | "suspended";

export type Suscripcion = {
  id: string;
  school_id: string;
  school_name: string;
  status: string;
  monthly_amount: number;
  next_payment_date: string;
  last_payment_date: string | null;
};

/** Días vencidos respecto de la fecha de próximo pago (0 si aún no vence). */
export function diasVencidos(nextPaymentDate: string | null | undefined) {
  if (!nextPaymentDate) return 0;
  const vence = new Date(`${nextPaymentDate}T12:00:00`).getTime();
  const dias = Math.floor((Date.now() - vence) / 86_400_000);
  return dias > 0 ? dias : 0;
}

/**
 * Comprueba si la cuenta puede usar la app. Un super admin nunca se bloquea.
 * Ante un error de red devolvemos acceso permitido: las vistas ya manejan
 * datos vacíos y no queremos dejar a la escuela fuera por una falla puntual.
 */
export async function accesoSuspendido(userId: string, email?: string | null) {
  if (esSuperAdmin(email)) return false;
  const [perfil, suscripcion] = await Promise.all([
    supabase.from("profiles").select("access_status").eq("id", userId).maybeSingle(),
    supabase.from("subscriptions").select("status").eq("school_id", userId).maybeSingle(),
  ]);
  if (perfil.error && suscripcion.error) return false;
  return (
    perfil.data?.access_status === "suspended" || suscripcion.data?.status === "suspended"
  );
}
