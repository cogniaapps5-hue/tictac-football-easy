import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Wallet, CalendarCheck, TriangleAlert, Megaphone, Apple, Check, X, Lock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Shell, Tarjeta, Estado } from "@/components/tictac/Shell";
import { RecordatoriosAdmin } from "@/components/tictac/Recordatorios";
import { useSesion, saludo, pesos, proximoEntrenamiento, fechaCorta } from "@/lib/session";

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
  if (!sesion) return null;
  return sesion.rol === "admin" ? (
    <Shell rol="admin" titulo={`${saludo()}, ${sesion.nombre}`} subtitulo="Escuela TIC TAC">
      <InicioAdmin />
    </Shell>
  ) : (
    <Shell rol="parent" titulo="Escuela TIC TAC" subtitulo={`${saludo()}, ${sesion.nombre}`}>
      <InicioPadre userId={sesion.userId} />
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
        supabase.from("payments").select("id, status, due_date"),
        supabase.from("players").select("id, access_status"),
        supabase.from("attendance").select("id, status").eq("session_date", proximo.iso),
      ]);
      const pendientes = (pagos.data ?? []).filter((p) => p.status === "pending");
      const atrasados = pendientes.filter(
        (p) => new Date(p.due_date).getTime() < Date.now() - 1000 * 60 * 60 * 24 * 60,
      );
      return {
        pendientes: pendientes.length,
        atrasados: atrasados.length,
        total: alumnos.data?.length ?? 0,
        bloqueados: (alumnos.data ?? []).filter((a) => a.access_status === "blocked").length,
        confirmados: (asistencia.data ?? []).filter((a) => a.status === "confirmed").length,
      };
    },
  });

  return (
    <>
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
    </>
  );
}

function InicioPadre({ userId }: { userId: string }) {
  const proximo = proximoEntrenamiento();
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["resumen-padre", userId, proximo.iso],
    queryFn: async () => {
      const { data: alumnos } = await supabase
        .from("players")
        .select("*")
        .eq("parent_id", userId)
        .order("name");
      const ids = (alumnos ?? []).map((a) => a.id);
      const [pagos, asistencia, avisos, nutricion, alertas, recordatorios] = await Promise.all([
        ids.length
          ? supabase.from("payments").select("*").in("player_id", ids).order("due_date")
          : Promise.resolve({ data: [] as never[] }),
        ids.length
          ? supabase.from("attendance").select("*").in("player_id", ids).eq("session_date", proximo.iso)
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
      ]);
      return {
        alumnos: alumnos ?? [],
        pagos: pagos.data ?? [],
        asistencia: asistencia.data ?? [],
        avisos: avisos.data ?? [],
        nutricion: nutricion.data ?? [],
        alertas: alertas.data ?? [],
        recordatorios: recordatorios.data ?? [],
      };
    },
  });

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
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["resumen-padre"] });
      toast.success(vars.estado === "confirmed" ? "¡Listo! Te esperamos" : "Gracias por avisar");
    },
    onError: () => toast.error("No pudimos guardar tu respuesta. Intenta otra vez."),
  });

  const alumno = data?.alumnos[0];
  const bloqueado = alumno?.access_status === "blocked";
  const pendiente = data?.pagos.find((p) => p.status === "pending");
  const rechazado = data?.pagos.find((p) => p.status === "rejected");
  const respuesta = data?.asistencia.find((a) => a.player_id === alumno?.id);
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const semestreActual = hoy.getMonth() < 6 ? 1 : 2;
  const nutricion = (data?.nutricion ?? []).find(
    (n) => n.player_id === alumno?.id && n.year === anioActual && n.semester === semestreActual,
  );

  // Recordatorio amable de mensualidad según el día del mes.
  const diaDelMes = hoy.getDate();
  const inicioMes = new Date(anioActual, hoy.getMonth(), 1).toISOString().slice(0, 10);
  const finMes = new Date(anioActual, hoy.getMonth() + 1, 1).toISOString().slice(0, 10);
  const pagoDelMes = (data?.pagos ?? []).find(
    (p) =>
      p.due_date >= inicioMes &&
      p.due_date < finMes &&
      (p.status === "approved" || (p.status === "pending" && p.receipt_url)),
  );
  const recordatorio =
    pagoDelMes || !alumno ? null : diaDelMes >= 6 ? "atrasado" : diaDelMes >= 1 ? "proximo" : null;

  return (
    <div className="space-y-6">
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

      {bloqueado ? (
        <div className="flex items-start gap-3 rounded-2xl border-[3px] border-danger bg-danger/20 p-5">
          <TriangleAlert className="mt-0.5 size-7 shrink-0 text-danger" />
          <p className="text-lg font-bold text-foreground">
            ⛔ ACCESO SUSPENDIDO — Pago pendiente desde el día 6. Sube tu comprobante.
          </p>
        </div>
      ) : null}

      <Tarjeta destacada className="border-[3px] p-6">
        <h2 className="text-2xl font-bold">⚽ Próximo entrenamiento</h2>
        <p className="mt-1 text-lg capitalize">
          {proximo.texto} — {alumno?.schedule ?? "Miércoles 15:00"}
        </p>
        {alumno && bloqueado ? (
          <p className="mt-4 text-lg font-semibold text-muted-foreground">
            Acceso suspendido hasta regularizar pago
          </p>
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
        {pendiente ? (
          <p className="mt-2 text-base">
            <Estado estado="pending" />
            <span className="mt-2 block">
              {pendiente.concept}: {pesos(pendiente.amount)} — vence {fechaCorta(pendiente.due_date)}
            </span>
          </p>
        ) : (
          <p className="mt-2 text-base">
            <Estado estado="approved" />
            <span className="mt-2 block">Todo al día. ¡Gracias!</span>
          </p>
        )}
        {rechazado ? (
          <div className="mt-3 flex items-start gap-3 rounded-xl bg-black/70 p-4 text-lg font-semibold text-white">
            <TriangleAlert className="mt-0.5 size-6 shrink-0 text-danger" />
            <span>
              Pago rechazado
              {rechazado.rejection_reason ? `: ${rechazado.rejection_reason}` : ""}
            </span>
          </div>
        ) : null}
        <Button asChild variant="accion" size="grande" className="mt-4">
          <Link to="/mi-hijo">Subir Comprobante</Link>
        </Button>
      </Tarjeta>

      <Tarjeta>
        <div className="flex items-center gap-3">
          <Apple className="size-7 text-success" />
          <h2 className="text-xl font-bold">Evaluación Nutricional</h2>
        </div>
        {!nutricion ? (
          <p className="mt-3 text-base text-muted-foreground">Evaluación no habilitada aún.</p>
        ) : nutricion.status === "booked" ? (
          <p className="mt-3 text-lg font-bold text-gold-brand">
            Hora agendada: {nutricion.scheduled_date ? fechaCorta(nutricion.scheduled_date) : "por confirmar"}
          </p>
        ) : (
          <>
            <p className="mt-2 text-base">
              Semestre {nutricion.semester} — aún sin hora agendada.
            </p>
            <Button asChild variant="alerta" size="grande" className="mt-4 min-h-[60px]">
              <a
                href={`https://wa.me/56912345678?text=${encodeURIComponent(
                  `Hola, quiero agendar la hora del nutricionista para ${alumno?.name ?? "mi hijo/a"}`,
                )}`}
                target="_blank"
                rel="noreferrer"
              >
                Agendar Hora
              </a>
            </Button>
          </>
        )}
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
              <p className="text-base font-bold">{aviso.title}</p>
              <p className="text-base text-muted-foreground">{aviso.content}</p>
            </li>
          ))}
          {!data?.avisos.length ? (
            <li className="text-base text-muted-foreground">Sin avisos por ahora.</li>
          ) : null}
        </ul>
      </Tarjeta>
    </div>
  );
}