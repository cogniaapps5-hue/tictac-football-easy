import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Mail, RefreshCw, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { limpiarSesion, sesionValida } from "@/lib/sesion";
import { accesoSuspendido, CONTACTO_SUSCRIPCION, MONTO_SUSCRIPCION } from "@/lib/suscripcion";
import { pesos } from "@/lib/session";

export const Route = createFileRoute("/servicio-suspendido")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Servicio suspendido — Escuela TIC TAC" },
      {
        name: "description",
        content: "La suscripción mensual de esta escuela está vencida y el acceso está suspendido.",
      },
      { property: "og:title", content: "Servicio suspendido — Escuela TIC TAC" },
      {
        property: "og:description",
        content: "Contacta al administrador para reactivar el servicio de la app TIC TAC.",
      },
    ],
  }),
  component: ServicioSuspendido,
});

function ServicioSuspendido() {
  const navigate = useNavigate();
  const [verificando, setVerificando] = useState(false);

  async function reintentar() {
    setVerificando(true);
    const sesion = await sesionValida();
    const user = sesion?.user;
    if (!user) {
      navigate({ to: "/", replace: true });
      return;
    }
    const bloqueado = await accesoSuspendido(user.id, user.email);
    setVerificando(false);
    if (!bloqueado) navigate({ to: "/inicio", replace: true });
  }

  async function salir() {
    await limpiarSesion();
    await supabase.auth.signOut().catch(() => undefined);
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-10 text-center">
      <AlertTriangle className="size-16 text-danger" />
      <h1 className="text-3xl font-extrabold">⚠️ SERVICIO SUSPENDIDO</h1>
      <p className="max-w-sm text-lg text-muted-foreground">
        Tu suscripción mensual está vencida. Para reactivar el servicio, contacta al administrador.
      </p>

      <div className="w-full max-w-sm space-y-3 rounded-2xl border-2 border-danger bg-card p-5 text-left">
        <div className="flex items-center gap-3">
          <Mail className="size-6 text-cyan-brand" />
          <a href={`mailto:${CONTACTO_SUSCRIPCION}`} className="text-lg font-bold text-cyan-brand">
            {CONTACTO_SUSCRIPCION}
          </a>
        </div>
        <p className="text-lg">
          Mensualidad del servicio:{" "}
          <span className="font-bold text-gold-brand">{pesos(MONTO_SUSCRIPCION)} CLP</span>
        </p>
      </div>

      <Button
        variant="accion"
        size="grande"
        className="max-w-sm"
        disabled={verificando}
        onClick={() => void reintentar()}
      >
        <RefreshCw className={verificando ? "animate-spin" : ""} /> Intentar nuevamente
      </Button>
      <Button variant="neutro" size="grande" className="max-w-sm" onClick={() => void salir()}>
        <LogOut /> Salir
      </Button>
    </div>
  );
}
