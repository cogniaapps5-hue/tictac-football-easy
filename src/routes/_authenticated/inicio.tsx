import { PantallaCargando, PantallaError, EstadoVacio } from "@/components/tictac/Estados";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Wallet,
  CalendarCheck,
  TriangleAlert,
  Lock,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Shell, Tarjeta } from "@/components/tictac/Shell";
import { RecordatoriosAdmin } from "@/components/tictac/Recordatorios";
import { ReportesAdmin } from "@/components/tictac/Reportes";
import { ContratosAdmin } from "@/components/tictac/Contratos";
import { InicioPadre } from "@/components/tictac/InicioPadre";
import { useSesion, useSaludo, pesos, proximoEntrenamiento } from "@/lib/session";
import { esSuperAdmin } from "@/lib/suscripcion";

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
  errorComponent: ({ error }) => (
    <PantallaError detalle={error instanceof Error ? error.message : undefined} />
  ),
});

function Inicio() {
  const { data: sesion, isLoading: cargandoSesion, isError: errorSesion, refetch: recargarSesion } = useSesion();
  const saludoActual = useSaludo();
  if (cargandoSesion) return <PantallaCargando />;
  if (errorSesion || !sesion)
    return (
      <PantallaError
        titulo="No pudimos cargar tu sesión"
        onReintentar={() => void recargarSesion()}
      />
    );
  return sesion.rol === "admin" ? (
    <Shell rol="admin" titulo={`${saludoActual}, ${sesion.nombre}`} subtitulo="Escuela TIC TAC">
      {esSuperAdmin(sesion.email) ? (
        <Button asChild variant="accion" size="grande">
          <Link to="/suscripciones">
            <ShieldCheck /> Panel de suscripciones
          </Link>
        </Button>
      ) : null}
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

  const {
    data,
    isLoading: cargando,
    isError: fallo,
    error: errorResumen,
    refetch,
  } = useQuery({
    queryKey: ["resumen-admin", proximo.iso],
    queryFn: async () => {
      const ahora = new Date();
      const inicioMes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-01`;
      const finMes = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
      const [pagos, alumnos, asistencia, pagosMes] = await Promise.all([
        supabase
          .from("payments")
          .select("id, status, due_date, amount, players(access_status, is_scholarship)"),
        supabase
          .from("players")
          .select("id, access_status, is_scholarship")
          .neq("access_status", "inactive"),
        supabase
          .from("attendance")
          .select("id, status, players(name)")
          .eq("session_date", proximo.iso),
        supabase
          .from("payments")
          .select("id, amount")
          .eq("status", "approved")
          .gte("due_date", inicioMes)
          .lte("due_date", finMes),
      ]);
      const fallida = [pagos, alumnos, asistencia, pagosMes].find((r) => r.error);
      if (fallida?.error) throw fallida.error;
      const activos = (pagos.data ?? []).filter((p) => {
        const alumno = p.players as
          | { access_status?: string; is_scholarship?: boolean | null }
          | null;
        // Los becados están exentos de cobro: no cuentan como pendientes.
        return alumno?.access_status !== "inactive" && !alumno?.is_scholarship;
      });
      const pendientes = activos.filter((p) => p.status === "pending");
      const aprobadosMes = pagosMes.data ?? [];
      const atrasados = pendientes.filter(
        (p) => new Date(p.due_date).getTime() < Date.now() - 1000 * 60 * 60 * 24 * 60,
      );
      return {
        pendientes: pendientes.length,
        ingresos: aprobadosMes.reduce(
          (suma: number, p: { amount: number | null }) => suma + (p.amount ?? 0),
          0,
        ),
        aprobados: aprobadosMes.length,
        atrasados: atrasados.length,
        total: alumnos.data?.length ?? 0,
        bloqueados: (alumnos.data ?? []).filter(
          (a) => a.access_status === "blocked" && !a.is_scholarship,
        ).length,
        confirmados: (asistencia.data ?? []).filter((a) => a.status === "confirmed").length,
        nombresConfirmados: (asistencia.data ?? [])
          .filter((a) => a.status === "confirmed")
          .map((a) => (a.players as { name?: string } | null)?.name ?? "Alumno")
          .sort((x, y) => x.localeCompare(y, "es")),
      };
    },
  });

  return (
    <>
      {cargando ? <PantallaCargando texto="Cargando resumen…" /> : null}
      {fallo ? (
        <PantallaError
          detalle={errorResumen instanceof Error ? errorResumen.message : undefined}
          onReintentar={() => void refetch()}
        />
      ) : null}
      <Tarjeta>
        <div className="flex items-start gap-4">
          <div
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"
            style={{
              boxShadow: "0 0 16px 2px color-mix(in oklab, var(--success) 45%, transparent)",
            }}
            aria-hidden="true"
          >
            <TrendingUp className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Ingresos de {new Date().toLocaleDateString("es-CL", { month: "long" })}
            </h2>
            <p className="text-[28px] font-extrabold leading-tight">{pesos(data?.ingresos ?? 0)}</p>
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

        <p className="mt-4 text-lg font-bold text-success">
          {data?.confirmados ?? 0}{" "}
          {data?.confirmados === 1
            ? "alumno confirmó asistencia"
            : "alumnos confirmaron asistencia"}
        </p>
        {data?.nombresConfirmados?.length ? (
          <details className="mt-2 rounded-xl bg-secondary p-4">
            <summary className="cursor-pointer text-base font-bold">
              Ver nombres de quienes confirmaron
            </summary>
            <ul className="mt-3 space-y-2">
              {data.nombresConfirmados.map((nombre, i) => (
                <li key={`${nombre}-${i}`} className="text-base font-semibold break-words">
                  ✅ {nombre}
                </li>
              ))}
            </ul>
          </details>
        ) : (
          <p className="mt-2 text-base text-muted-foreground">
            Todavía nadie confirma para esta clase.
          </p>
        )}

        <Button
          variant="neutro"
          size="grande"
          className="mt-4 w-full"
          onClick={() => void refetch()}
        >
          <RefreshCw /> Actualizar asistencia
        </Button>
        <Button asChild variant="contorno" size="grande" className="mt-3">
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
            ⚠️ {revision} {revision === 1 ? "alumno fue bloqueado" : "alumnos fueron bloqueados"}{" "}
            hoy. Envía aviso manual por WhatsApp si es necesario.
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
