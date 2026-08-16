import { PantallaCargando, PantallaError, EstadoVacio } from "@/components/tictac/Estados";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarDays, Check, Megaphone, User, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tarjeta, Estado } from "@/components/tictac/Shell";
import { SEDES, categoriaAviso, grupoCorto, grupoEtiqueta, proximoEntrenamiento } from "@/lib/session";

function edadDe(fecha?: string | null) {
  if (!fecha) return null;
  const [a, m, d] = String(fecha).split("-").map(Number);
  const hoy = new Date();
  let edad = hoy.getFullYear() - a;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) edad -= 1;
  return edad;
}

/**
 * Inicio del apoderado: cálido y familiar. Sin mensajes de cobro ni bloqueo
 * (esos viven en la pestaña "Mi Hijo").
 */
export function InicioPadre({
  userId,
  nombreApoderado,
}: {
  userId: string;
  nombreApoderado: string;
}) {
  const fechasPosibles = SEDES.map((s) => proximoEntrenamiento(s.valor).iso);
  const queryClient = useQueryClient();
  const [hijoId, setHijoId] = useState<string | null>(null);
  const [verTodos, setVerTodos] = useState(false);

  const {
    data,
    isLoading: cargando,
    isError: fallo,
    error: errorDatos,
    refetch,
  } = useQuery({
    queryKey: ["resumen-padre", userId, fechasPosibles.join(",")],
    queryFn: async () => {
      const { data: alumnos, error: errorAlumnos } = await supabase
        .from("players")
        .select("*")
        .eq("parent_id", userId)
        .order("name");
      const ids = (alumnos ?? []).map((a) => a.id);
      const [asistencia, avisos, perfil] = await Promise.all([
        ids.length
          ? supabase
              .from("attendance")
              .select("*")
              .in("player_id", ids)
              .in("session_date", fechasPosibles)
          : Promise.resolve({ data: [] as never[], error: null }),
        supabase.from("notices").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("profiles").select("contract_accepted_at").eq("id", userId).maybeSingle(),
      ]);
      if (errorAlumnos) throw errorAlumnos;
      if ("error" in asistencia && asistencia.error) throw asistencia.error;
      if (avisos.error) throw avisos.error;
      if (perfil.error) throw perfil.error;
      return {
        alumnos: alumnos ?? [],
        asistencia: asistencia.data ?? [],
        avisos: avisos.data ?? [],
        contrato: perfil.data?.contract_accepted_at ?? null,
      };
    },
  });

  const hijos = data?.alumnos ?? [];
  const alumno = hijos.find((a) => a.id === hijoId) ?? hijos[0];
  const proximo = proximoEntrenamiento(alumno?.training_day ?? null);
  const bloqueado = alumno?.access_status === "blocked";
  const respuesta = data?.asistencia.find(
    (a) => a.player_id === alumno?.id && a.session_date === proximo.iso,
  );

  const hoy = new Date();
  const cumpleaneros = hijos.filter((a) => {
    if (!a.birth_date) return false;
    const [, mes, dia] = String(a.birth_date).split("-").map(Number);
    return mes === hoy.getMonth() + 1 && dia === hoy.getDate();
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
      toast.success(
        vars.estado === "confirmed" ? "¡Listo! Te esperamos ⚽" : "Gracias por avisar 💙",
      );
    },
    onError: () => toast.error("No pudimos guardar tu respuesta. Intenta otra vez."),
  });

  if (cargando) return <PantallaCargando texto="Cargando tu información…" />;
  if (fallo)
    return (
      <PantallaError
        detalle={errorDatos instanceof Error ? errorDatos.message : undefined}
        onReintentar={() => void refetch()}
      />
    );

  return (
    <div className="animate-fade-in space-y-6">
      {!hijos.length ? (
        <EstadoVacio
          emoji="👦"
          texto="Todavía no hay alumnos asociados a tu cuenta. Escríbele a la escuela para activarlos."
        />
      ) : null}
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
        </Tarjeta>
      ) : null}

      <section className="rounded-2xl border border-cyan-brand/40 bg-[linear-gradient(140deg,color-mix(in_oklab,var(--cyan-brand)_22%,var(--card)),color-mix(in_oklab,var(--cyan-brand)_6%,var(--card)))] p-7 shadow-card">
        <p className="text-5xl" aria-hidden>
          ⚽
        </p>
        <h2 className="mt-3 text-2xl font-black leading-tight">Bienvenido a la Familia TIC TAC</h2>
        <p className="mt-2 text-lg font-semibold text-muted-foreground">
          Hola {nombreApoderado} 👋
        </p>
        <p className="mt-4 text-center text-[20px] font-bold italic text-gold-brand">
          “Todos jugamos, todos aprendemos y todos pertenecemos”
        </p>
      </section>

      {cumpleaneros.map((c) => (
        <div
          key={c.id}
          className="rounded-2xl border-[3px] border-gold-brand bg-gold-brand/25 p-5 text-center"
        >
          <p className="animate-bounce text-3xl" aria-hidden>
            🎉🎂🎈
          </p>
          <p className="mt-2 text-xl font-black">¡Feliz Cumpleaños a {c.name}!</p>
          <p className="mt-1 text-lg font-semibold">El equipo TIC TAC te desea un gran día.</p>
        </div>
      ))}

      {data && !alumno ? (
        <Tarjeta destacada>
          <p className="text-lg font-bold">
            No hay alumnos registrados en tu cuenta. Contacta a administración para vincular a tu
            hijo o hija.
          </p>
        </Tarjeta>
      ) : null}

      {data && !data.contrato ? (
        <Tarjeta>
          <p className="text-lg font-bold">📋 Te falta aceptar el reglamento de la escuela.</p>
          <Button asChild variant="alerta" size="grande" className="mt-4">
            <Link to="/contrato">Ver y aceptar contrato</Link>
          </Button>
        </Tarjeta>
      ) : null}

      <Tarjeta destacada className="border-[3px] p-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="size-7 text-cyan-brand" />
          <h2 className="text-2xl font-black">Próximo Entrenamiento</h2>
        </div>
        <p className="mt-4 text-lg font-bold">📅 Día: Martes y Jueves</p>
        <p className="mt-1 text-lg font-bold">⏰ Hora: 19:00 a 20:00 hrs</p>
        <p className="mt-1 text-lg font-bold">
          📍 Sede: Rancho Rossi Peñuelas / Forza Club Simdempart
        </p>
        <p className="mt-3 text-base capitalize text-muted-foreground">
          Tu próxima clase: {proximo.texto} — {proximo.sede}
        </p>

        {alumno && bloqueado ? (
          <Button asChild variant="neutro" size="gigante" className="mt-5">
            <Link to="/mi-hijo">Regularizar pago para confirmar</Link>
          </Button>
        ) : alumno ? (
          respuesta ? (
            <div className="mt-5">
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
            <div className="mt-5 space-y-4">
              <Button
                variant="exito"
                size="gigante"
                disabled={responder.isPending}
                onClick={() => responder.mutate({ playerId: alumno.id, estado: "confirmed" })}
              >
                <Check /> ✅ Confirmar Asistencia
              </Button>
              <Button
                variant="neutro"
                size="grande"
                disabled={responder.isPending}
                onClick={() => responder.mutate({ playerId: alumno.id, estado: "absent" })}
              >
                <X /> Esta vez no puede ir
              </Button>
            </div>
          )
        ) : null}
      </Tarjeta>

      {alumno ? (
        <Tarjeta className="p-6">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-full bg-secondary text-3xl">
              <User className="size-8 text-cyan-brand" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-bold">{alumno.name}</h2>
              <p className="text-base text-muted-foreground">
                Categoría {grupoCorto(alumno.age_group)}
              </p>
              {edadDe(alumno.birth_date) !== null ? (
                <p className="text-base text-muted-foreground">{edadDe(alumno.birth_date)} años</p>
              ) : null}
            </div>
          </div>
          <Button asChild variant="contorno" size="grande" className="mt-5">
            <Link to="/mi-hijo">Ver ficha completa</Link>
          </Button>
        </Tarjeta>
      ) : null}

      {data?.avisos.length ? (
        <Tarjeta className="p-6">
          <div className="flex items-center gap-3">
            <Megaphone className="size-7 text-gold-brand" />
            <h2 className="text-xl font-bold">Avisos de la Escuela</h2>
          </div>
          <ul className="mt-4 space-y-4">
            {data.avisos.slice(0, verTodos ? 10 : 3).map((aviso) => (
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
          </ul>
          {data.avisos.length > 3 ? (
            <Button
              variant="contorno"
              size="grande"
              className="mt-5"
              onClick={() => setVerTodos(!verTodos)}
            >
              {verTodos ? "Ver menos avisos" : "Ver todos los avisos"}
            </Button>
          ) : null}
        </Tarjeta>
      ) : null}
    </div>
  );
}
