import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Wallet, CalendarCheck, TriangleAlert, Megaphone, Apple, Check, X, Lock, TrendingUp } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Shell, Tarjeta, Estado } from "@/components/tictac/Shell";
import { RecordatoriosAdmin } from "@/components/tictac/Recordatorios";
import { ReportesAdmin } from "@/components/tictac/Reportes";
import { ContratosAdmin } from "@/components/tictac/Contratos";
import { SubirComprobante } from "@/components/tictac/SubirComprobante";
import {
  useSesion,
  useSaludo,
  pesos,
  proximoEntrenamiento,
  fechaCorta,
  SEDES,
  categoriaAviso,
} from "@/lib/session";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({
    meta: [
      { title: "Inicio — Escuela TIC TAC" },
      { name: "description", content: "Resumen del día en la escuela de fútbol TIC TAC." },
      { property: "og:title", content: "Inicio — Escuela TIC TAC" },
      { property: "og:description", content: "Resumen del día en la escuela de fútbol TIC TAC." },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const { data: sesion } = useSesion();
  const saludoActual = useSaludo();
  if (!sesion) return null;
  return sesion.rol === "admin" ? (
    <Shell rol="admin" titulo={`${saludoActual}, ${sesion.nombre}`} subtitulo="Escuela TIC TAC">
      <InicioAdmin />
    </Shell>
  ) : (
    <Shell rol="parent" titulo="Escuela TIC TAC" subtitulo={`${saludoActual}, ${sesion.nombre}`}>
      <InicioPadre userId={sesion.userId} nombreApoderado={sesion.nombre} />
    </Shell>
  );
}

function InicioAdmin() {
  const proximo = proximoEntrenamiento();
  const queryClientAdmin = useQueryClient();

  // Validación diaria en frontend (reemplaza el cron): al abrir la app, la
  // administradora dispara la revisión de morosidad del mes en curso.
  const { data: revision } = useQuery({
    queryKey: ["revision-morosidad", new Date().toISOString().slice(0, 10)],
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const { data: bloqueadosHoy, error } = await supabase.rpc("aplicar_bloqueos_morosidad");
      if (error) throw error;
      await queryClientAdmin.invalidateQueries({ queryKey: ["resumen-admin"] });
      await queryClientAdmin.invalidateQueries({ queryKey: ["alumnos"] });
      return bloqueadosHoy ?? 0;
    },
  });

  const { data } = useQuery({
    queryKey: ["resumen-admin", proximo.iso],
    queryFn: async () => {
      const [pagos, alumnos, asistencia] = await Promise.all([
        supabase.from("payments").select("id, status, due_date, amount"),
        supabase.from("players").select("id, access_status"),
        supabase.from("attendance").select("id, status").eq("session_date", proximo.iso),
      ]);
      const pendientes = (pagos.data ?? []).filter((p) => p.status === "pending");
      const aprobados = (pagos.data ?? []).filter((p) => p.status === "approved");
      const atrasados = pendientes.filter(
        (p) => new Date(p.due_date).getTime() < Date.now() - 1000 * 60 * 60 * 24 * 60,
      );
      return {
        pendientes: pendientes.length,
        ingresos: aprobados.reduce((suma, p) => suma + (p.amount ?? 0), 0),
        aprobados: aprobados.length,
        atrasados: atrasados.length,
        total: alumnos.data?.length ?? 0,
        bloqueados: (alumnos.data ?? []).filter((a) => a.access_status === "blocked").length,
        confirmados: (asistencia.data ?? []).filter((a) => a.status === "confirmed").length,
      };
    },
  });

  return (
    <>
      <Tarjeta>
        <div className="flex items-start gap-4">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"
            style={{ boxShadow: "0 0 16px 2px color-mix(in oklab, var(--success) 45%, transparent)" }}
            aria-hidden="true"
          >
            <TrendingUp className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Ingresos</h2>
            <p className="text-[28px] font-extrabold leading-tight">
              {pesos(data?.ingresos ?? 0)}
            </p>
            <p className="text-xs font-semibold text-success">
              {data?.aprobados ?? 0} {data?.aprobados === 1 ? "pago aprobado" : "pagos aprobados"}
            </p>
          </div>
        </div>
      </Tarjeta>

      <Tarjeta destacada>
        <div className="flex items-center gap-3">
          <Wallet className="size-7 text-gold-brand" />
          <h2 className="text-xl font-bold">Pagos pendientes</h2>
        </div>
        <p className="mt-2 text-3xl font-extrabold text-gold-brand">{data?.pendientes ?? 0}</p>
        <p className="text-base text-muted-foreground">comprobantes por revisar</p>
        <Button asChild variant="accion" size="grande" className="mt-4">
          <Link to="/pagos">Ver y Aprobar</Link>
        </Button>
      </Tarjeta>

      <RecordatoriosAdmin />

      <Tarjeta>
        <div className="flex items-center gap-3">
          <CalendarCheck className="size-7 text-cyan-brand" />
          <h2 className="text-xl font-bold">Asistencia próxima clase</h2>
        </div>
        <p className="mt-2 text-2xl font-extrabold">
          {data?.confirmados ?? 0} de {data?.total ?? 0} confirmados
        </p>
        <p className="text-lg font-bold text-cyan-brand">{proximo.titulo}</p>
        <p className="text-base font-semibold">📍 {proximo.sede}</p>
        <p className="text-base capitalize text-muted-foreground">{proximo.texto}</p>
        <Button asChild variant="contorno" size="grande" className="mt-4">
          <Link to="/alumnos">Ver Lista</Link>
        </Button>
      </Tarjeta>

      <Tarjeta>
        <div className="flex items-center gap-3">
          <Lock className="size-7 text-danger" />
          <h2 className="text-xl font-bold">Alumnos bloqueados hoy</h2>
        </div>
        <p className="mt-2 text-3xl font-extrabold text-danger">{data?.bloqueados ?? 0}</p>
        <p className="text-base text-muted-foreground">por pago pendiente</p>
        {revision ? (
          <p className="mt-3 rounded-xl bg-black/70 p-3 text-base font-semibold text-white">
            ⚠️ {revision} {revision === 1 ? "alumno fue bloqueado" : "alumnos fueron bloqueados"} hoy. Envía aviso
            manual por WhatsApp si es necesario.
          </p>
        ) : null}
        <Button asChild variant="contorno" size="grande" className="mt-4">
          <Link to="/alumnos">Gestionar Bloqueos</Link>
        </Button>
      </Tarjeta>

      <Tarjeta>
        <div className="flex items-center gap-3">
          <TriangleAlert className="size-7 text-danger" />
          <h2 className="text-xl font-bold">Alertas</h2>
        </div>
        <p className="mt-2 text-base">
          {data?.atrasados
            ? `${data.atrasados} pagos atrasados (2 meses o más)`
            : "Sin pagos muy atrasados. Todo tranquilo."}
        </p>
      </Tarjeta>

      <ContratosAdmin />

      <ReportesAdmin />
    </>
  );
}

