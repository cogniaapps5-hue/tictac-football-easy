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

function InicioPadre({ userId, nombreApoderado }: { userId: string; nombreApoderado: string }) {
  const proximoGeneral = proximoEntrenamiento();
  const fechasPosibles = SEDES.map((s) => proximoEntrenamiento(s.valor).iso);
  const queryClient = useQueryClient();
  const [avisoBloqueo, setAvisoBloqueo] = useState(false);
  const [hijoId, setHijoId] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["resumen-padre", userId, fechasPosibles.join(",")],
    queryFn: async () => {
      const { data: alumnos } = await supabase
        .from("players")
        .select("*")
        .eq("parent_id", userId)
        .order("name");
      const ids = (alumnos ?? []).map((a) => a.id);
      const [pagos, asistencia, avisos, nutricion, alertas, recordatorios, perfil] = await Promise.all([
        ids.length
          ? supabase.from("payments").select("*").in("player_id", ids).order("due_date")
          : Promise.resolve({ data: [] as never[] }),
        ids.length
          ? supabase.from("attendance").select("*").in("player_id", ids).in("session_date", fechasPosibles)
          : Promise.resolve({ data: [] as never[] }),
        supabase.from("notices").select("*").order("created_at", { ascending: false }).limit(3),
        ids.length
          ? supabase.from("nutrition_sessions").select("*").in("player_id", ids)
          : Promise.resolve({ data: [] as never[] }),
        ids.length
          ? supabase
              .from("notifications")
              .select("*")
              .in("player_id", ids)
              .order("created_at", { ascending: false })
              .limit(3)
          : Promise.resolve({ data: [] as never[] }),
        ids.length
          ? supabase
              .from("payment_reminders")
              .select("id, message, sent_at")
              .in("player_id", ids)
              .eq("status", "sent")
              .order("sent_at", { ascending: false })
              .limit(3)
          : Promise.resolve({ data: [] as never[] }),
        supabase.from("profiles").select("contract_accepted_at").eq("id", userId).maybeSingle(),
      ]);
      return {
        alumnos: alumnos ?? [],
        pagos: pagos.data ?? [],
        asistencia: asistencia.data ?? [],
        avisos: avisos.data ?? [],
        nutricion: nutricion.data ?? [],
        alertas: alertas.data ?? [],
        recordatorios: recordatorios.data ?? [],
        contrato: perfil.data?.contract_accepted_at ?? null,
      };
    },
  });

  const hijos = data?.alumnos ?? [];
  const alumno = hijos.find((a) => a.id === hijoId) ?? hijos[0];
  const pagosAlumno = (data?.pagos ?? []).filter((p) => p.player_id === alumno?.id);
  const proximo = proximoEntrenamiento(alumno?.training_day ?? proximoGeneral.dia);

  const responder = useMutation({
    mutationFn: async ({ playerId, estado }: { playerId: string; estado: string }) => {
      const { error } = await supabase
        .from("attendance")
        .upsert(
          { player_id: playerId, session_date: proximo.iso, status: estado },
          { onConflict: "player_id,session_date" },
        );
      if (error) throw error;
    },
    // Respuesta instantánea: pintamos el estado antes de que responda el servidor.
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["resumen-padre"] });
      const clave = ["resumen-padre", userId, fechasPosibles.join(",")];
      const previo = queryClient.getQueryData<typeof data>(clave);
      queryClient.setQueryData(clave, (actual: typeof data) => {
        if (!actual) return actual;
        const otras = actual.asistencia.filter(
          (a) => !(a.player_id === vars.playerId && a.session_date === proximo.iso),
        );
        return {
          ...actual,
          asistencia: [
            ...otras,
            {
              id: `optimista-${vars.playerId}`,
              player_id: vars.playerId,
              session_date: proximo.iso,
              status: vars.estado,
              created_at: new Date().toISOString(),
            },
          ],
        };
      });
      return { clave, previo };
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["resumen-padre"] });
      toast.success(vars.estado === "confirmed" ? "¡Listo! Te esperamos" : "Gracias por avisar");
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previo) queryClient.setQueryData(ctx.clave, ctx.previo);
      toast.error("No pudimos guardar tu respuesta. Intenta otra vez.");
    },
  });

  const bloqueado = alumno?.access_status === "blocked";
  const pendiente = pagosAlumno.find((p) => p.status === "pending");
  const rechazado = pagosAlumno.find((p) => p.status === "rejected");
  const respuesta = data?.asistencia.find(
    (a) => a.player_id === alumno?.id && a.session_date === proximo.iso,
  );
  const hoy = new Date();
  const anioActual = hoy.getFullYear();

  // Cumpleaños: compara día y mes de la fecha de nacimiento con la fecha actual.
  // Al depender de `hoy`, el saludo desaparece solo al cambiar el día.
  const cumpleaneros = (data?.alumnos ?? []).filter((a) => {
    if (!a.birth_date) return false;
    const [, mes, dia] = String(a.birth_date).split("-").map(Number);
    return mes === hoy.getMonth() + 1 && dia === hoy.getDate();
  });

  // Recordatorio amable de mensualidad según el día del mes.
  const diaDelMes = hoy.getDate();
  const inicioMes = new Date(anioActual, hoy.getMonth(), 1).toISOString().slice(0, 10);
  const finMes = new Date(anioActual, hoy.getMonth() + 1, 1).toISOString().slice(0, 10);
  const pagoDelMes = pagosAlumno.find(
    (p) =>
      p.due_date >= inicioMes &&
      p.due_date < finMes &&
      (p.status === "approved" || (p.status === "pending" && p.receipt_url)),
  );
  const recordatorio =
    pagoDelMes || !alumno ? null : diaDelMes >= 6 ? "atrasado" : diaDelMes >= 1 ? "proximo" : null;

  const pagosMes = pagosAlumno.filter((p) => p.due_date >= inicioMes && p.due_date < finMes);
  const pagoAprobado = pagosMes.find((p) => p.status === "approved");
  const pagoEnRevision = pagosMes.find((p) => p.status === "pending" && p.receipt_url);
  // El botón se habilita siempre que el padre necesite subir un comprobante:
  // pago rechazado, pendiente sin comprobante, o alumno bloqueado por morosidad.
  const puedeSubirComprobante = Boolean(rechazado) || bloqueado || !(pagoAprobado || pagoEnRevision);
  const whatsapp = `https://wa.me/56912345678?text=${encodeURIComponent(
    `Hola, necesito ayuda con el pago de la mensualidad de ${alumno?.name ?? "mi hijo/a"}`,
  )}`;

  return (
    <div className="space-y-6">
      {hijos.length > 1 ? (
        <Tarjeta>
          <h2 className="text-xl font-bold">👨‍👩‍👧‍👦 ¿Qué hijo quieres ver?</h2>
          <div className="mt-4 flex flex-wrap gap-4">
            {hijos.map((h) => (
              <Button
                key={h.id}
                variant={h.id === alumno?.id ? "accion" : "neutro"}
                size="medio"
                aria-pressed={h.id === alumno?.id}
                className="h-auto min-h-[60px] flex-1 py-4 text-base"
                onClick={() => setHijoId(h.id)}
              >
                {h.name.split(" ")[0]}
              </Button>
            ))}
          </div>
          <p className="mt-3 text-base text-muted-foreground">
            Estás viendo la información de {alumno?.name}.
          </p>
        </Tarjeta>
      ) : null}
      {data && !alumno ? (
        <Tarjeta destacada>
          <p className="text-lg font-bold">
            No hay alumnos registrados en tu cuenta. Contacta a administración para vincular a tu
            hijo o hija.
          </p>
        </Tarjeta>
      ) : null}
      {bloqueado && alumno ? (
        <div className="rounded-2xl border-2 border-gold-brand bg-gold-brand/20 p-5">
          <p className="text-lg font-bold text-foreground">
            🌟 Hola {nombreApoderado}, para que {alumno.name.split(" ")[0]} pueda entrenar con
            nosotros, necesitamos regularizar el pago de la mensualidad. ¡Te esperamos! 💙
          </p>
          <div className="mt-4">
            <SubirComprobante
              playerId={alumno.id}
              pagoId={pendiente?.id ?? null}
              userId={userId}
              etiqueta="Subir Comprobante Ahora"
            />
          </div>
        </div>
      ) : null}
      {cumpleaneros.map((c) => (
        <div
          key={c.id}
          className="rounded-2xl border-[3px] border-gold-brand bg-gold-brand/25 p-5 text-center shadow-[0_0_24px_oklch(0.82_0.16_85/0.35)]"
        >
          <p className="animate-bounce text-3xl" aria-hidden>
            🎉🎂🎈
          </p>
          <p className="mt-2 text-xl font-black text-foreground">
            ¡Feliz Cumpleaños a {c.name}!
          </p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            El equipo TIC TAC te desea un gran día.
          </p>
        </div>
      ))}
      {data && !data.contrato ? (
        <div className="rounded-2xl border-2 border-gold-brand bg-gold-brand/20 p-5">
          <div className="flex items-start gap-3">
            <span aria-hidden className="text-2xl">⚠️</span>
            <p className="text-lg font-bold text-foreground">
              Debes aceptar el reglamento para continuar usando la app
            </p>
          </div>
          <Button asChild variant="alerta" size="gigante" className="mt-4">
            <Link to="/contrato">Aceptar ahora</Link>
          </Button>
        </div>
      ) : null}
      {recordatorio === "proximo" ? (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-gold-brand bg-gold-brand/20 p-5">
          <span aria-hidden className="text-2xl">⏰</span>
          <p className="text-lg font-bold text-foreground">
            Tu mensualidad vence el día 6. ¡No olvides subir tu comprobante! 🌟
          </p>
        </div>
      ) : null}
      {recordatorio === "atrasado" ? (
        <div className="flex items-start gap-3 rounded-2xl border-2 border-[oklch(0.75_0.18_60)] bg-[oklch(0.75_0.18_60)]/25 p-5">
          <span aria-hidden className="text-2xl">⚠️</span>
          <p className="text-lg font-bold text-foreground">
            Tu pago está pendiente. Por favor regulariza tu situación para mantener tu acceso activo. 🙏
          </p>
        </div>
      ) : null}

      <Tarjeta destacada className="border-[3px] p-6">
        <h2 className="text-2xl font-black tracking-tight">⚽ PRÓXIMO ENTRENAMIENTO</h2>
        <p className="mt-2 text-3xl font-extrabold text-cyan-brand">{proximo.titulo}</p>
        <p className="mt-1 text-xl font-bold">📍 {proximo.sede}</p>
        <p className="mt-1 text-base capitalize text-muted-foreground">{proximo.texto}</p>
        {alumno && bloqueado ? (
          <div className="mt-4 space-y-3">
            <Button
              variant="neutro"
              size="gigante"
              disabled
              aria-disabled
              className="cursor-not-allowed bg-muted text-muted-foreground opacity-70"
              onClick={() => setAvisoBloqueo(true)}
            >
              Regulariza tu pago para confirmar asistencia
            </Button>
            <p className="text-base text-muted-foreground">
              Apenas revisemos tu comprobante podrás confirmar asistencia. ¡Gracias! 🙏
            </p>
          </div>
        ) : alumno ? (
          <>
            <p className="mt-4 text-lg font-semibold">¿Viene {alumno.name.split(" ")[0]}?</p>
            {respuesta ? (
              <div className="mt-3">
                <Estado estado={respuesta.status} />
                <Button
                  variant="neutro"
                  size="medio"
                  className="mt-3 w-full"
                  onClick={() =>
                    responder.mutate({
                      playerId: alumno.id,
                      estado: respuesta.status === "confirmed" ? "absent" : "confirmed",
                    })
                  }
                >
                  Cambiar respuesta
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <Button
                  variant="exito"
                  size="gigante"
                  disabled={responder.isPending}
                  onClick={() => responder.mutate({ playerId: alumno.id, estado: "confirmed" })}
                >
                  <Check /> SÍ VOY
                </Button>
                <Button
                  variant="peligro"
                  size="gigante"
                  disabled={responder.isPending}
                  onClick={() => responder.mutate({ playerId: alumno.id, estado: "absent" })}
                >
                  <X /> NO VOY
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="mt-3 text-base text-muted-foreground">
            Aún no tienes alumnos asociados. Habla con la administradora.
          </p>
        )}
      </Tarjeta>

      <Tarjeta>
        <div className="flex items-center gap-3">
          <Wallet className="size-7 text-cyan-brand" />
          <h2 className="text-xl font-bold">Pagos</h2>
        </div>
        {pagoAprobado ? (
          <div className="mt-3 space-y-2">
            <Estado estado="approved" />
            <p className="text-lg font-bold">✅ ¡Todo en orden!</p>
            <p className="text-base">
              Tu pago de este mes está confirmado. {alumno?.name ?? "Tu hijo/a"} puede entrenar sin
              problemas.
            </p>
            <p className="text-base">¡Nos vemos en la cancha! ⚽💙</p>
          </div>
        ) : pagoEnRevision ? (
          <div className="mt-3 space-y-2">
            <Estado estado="pending" />
            <p className="text-lg font-bold">✅ ¡Comprobante recibido!</p>
            <p className="text-base">
              Estamos revisando tu pago. En cuanto lo confirmemos, te avisaremos.
            </p>
            <p className="text-base">
              Mientras tanto, tu hijo puede entrenar normalmente. ¡Gracias por tu paciencia! 🙏
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-lg font-bold">📋 Tu pago está pendiente</p>
            <p className="text-base">
              Sabemos que a veces se nos olvida subir el comprobante. Si ya pagaste, por favor súbelo
              aquí para que podamos confirmarlo.
            </p>
            <p className="text-base">
              Si necesitas ayuda, escríbenos por WhatsApp y te orientamos. 💬
            </p>
            {pendiente ? (
              <p className="text-base text-muted-foreground">
                {pendiente.concept}: {pesos(pendiente.amount)} — vence {fechaCorta(pendiente.due_date)}
              </p>
            ) : null}
          </div>
        )}
        {rechazado ? (
          <div className="mt-3 flex items-start gap-3 rounded-xl bg-black/70 p-4 text-lg font-semibold text-white">
            <TriangleAlert className="mt-0.5 size-6 shrink-0 text-danger" />
            <span>
              No pudimos confirmar tu último comprobante
              {rechazado.rejection_reason ? `: ${rechazado.rejection_reason}` : ""}
            </span>
          </div>
        ) : null}
        <div className="mt-4 space-y-4">
          {puedeSubirComprobante ? (
            alumno ? (
              <SubirComprobante
                playerId={alumno.id}
                pagoId={pendiente?.id ?? rechazado?.id ?? null}
                userId={userId}
              />
            ) : null
          ) : (
            <Button
              disabled
              size="grande"
              className="h-auto min-h-[60px] w-full cursor-not-allowed bg-muted py-4 text-base text-muted-foreground opacity-100 hover:bg-muted"
              title={pagoAprobado ? "Pago confirmado" : "Comprobante ya enviado"}
            >
              {pagoAprobado ? "Pago confirmado" : "Comprobante ya enviado"}
            </Button>
          )}
          {!pagoAprobado && !pagoEnRevision ? (
            <Button asChild variant="contorno" size="grande">
              <a href={whatsapp} target="_blank" rel="noreferrer">
                Contactar por WhatsApp
              </a>
            </Button>
          ) : null}
        </div>
      </Tarjeta>

      <Tarjeta className="relative opacity-75">
        <span className="absolute right-4 top-4 rounded-full bg-gold-brand/25 px-3 py-1 text-xs font-bold tracking-wide text-gold-brand">
          PRÓXIMAMENTE 2027
        </span>
        <div className="flex items-center gap-3">
          <Apple className="size-7 text-success" />
          <h2 className="text-xl font-bold">Evaluación Nutricional</h2>
        </div>
        <button
          type="button"
          title="Disponible en 2027"
          aria-disabled="true"
          onClick={() => toast("Próximamente en 2027")}
          className="mt-4 flex min-h-[60px] w-full cursor-not-allowed items-center justify-center rounded-xl bg-[#6B7280] px-4 py-4 text-lg font-bold text-white"
        >
          Próximamente
        </button>
        <p className="mt-3 text-sm text-muted-foreground">
          🌟 La evaluación nutricional estará disponible a partir de 2027. ¡Mantente atento!
        </p>
      </Tarjeta>

      <Tarjeta>
        <div className="flex items-center gap-3">
          <Megaphone className="size-7 text-gold-brand" />
          <h2 className="text-xl font-bold">Avisos</h2>
        </div>
        <ul className="mt-3 space-y-4">
          {(data?.recordatorios ?? []).map((r) => (
            <li key={r.id} className="rounded-xl border-2 border-gold-brand bg-gold-brand/15 p-4">
              <p className="text-base font-bold">🌟 Recordatorio de mensualidad</p>
              <p className="whitespace-pre-line text-base">{r.message}</p>
            </li>
          ))}
          {(data?.alertas ?? []).map((alerta) => (
            <li key={alerta.id} className="rounded-xl border-2 border-danger bg-danger/15 p-4">
              <p className="text-base font-bold">⚠️ {alerta.title}</p>
              <p className="text-base">{alerta.body}</p>
            </li>
          ))}
          {(data?.avisos ?? []).map((aviso) => (
            <li key={aviso.id} className="rounded-xl bg-secondary p-4">
              <span
                className={`mb-2 inline-block rounded-full px-3 py-1 text-sm font-bold ${categoriaAviso(aviso.category).clase}`}
              >
                {categoriaAviso(aviso.category).emoji} {categoriaAviso(aviso.category).etiqueta}
              </span>
              <p className="text-base font-bold">{aviso.title}</p>
              <p className="text-base text-muted-foreground">{aviso.content}</p>
            </li>
          ))}
          {!data?.avisos.length ? (
            <li className="text-base text-muted-foreground">Sin avisos por ahora.</li>
          ) : null}
        </ul>
      </Tarjeta>

      <Dialog open={avisoBloqueo} onOpenChange={setAvisoBloqueo}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">¡Hola! 👋</DialogTitle>
            <DialogDescription className="space-y-3 text-left text-base text-foreground">
              <span className="block">
                Notamos que tu pago de este mes está pendiente. Para confirmar la asistencia de{" "}
                {alumno?.name ?? "tu hijo/a"}, primero necesitamos regularizar tu situación.
              </span>
              <span className="block">
                No te preocupes, puedes subir tu comprobante ahora mismo y en cuanto lo revisemos, tu
                acceso quedará habilitado.
              </span>
              <span className="block font-semibold">¿Quieres subir tu comprobante ahora?</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-4 sm:flex-col">
            {alumno ? (
              <SubirComprobante
                playerId={alumno.id}
                pagoId={pendiente?.id ?? null}
                userId={userId}
              />
            ) : null}
            <Button variant="neutro" size="grande" onClick={() => setAvisoBloqueo(false)}>
              Después
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}