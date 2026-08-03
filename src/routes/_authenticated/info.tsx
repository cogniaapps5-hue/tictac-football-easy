import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Target, Users, Images, ScrollText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Shell, Tarjeta } from "@/components/tictac/Shell";
import { supabase } from "@/integrations/supabase/client";
import { useSesion } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/info")({
  head: () => ({
    meta: [
      { title: "Información — Escuela TIC TAC" },
      { name: "description", content: "Reglamento, objetivo y profesores de la escuela TIC TAC." },
      { property: "og:title", content: "Información — Escuela TIC TAC" },
      { property: "og:description", content: "Reglamento, objetivo y profesores de la escuela." },
    ],
  }),
  component: Info,
});

function Info() {
  const { data: sesion } = useSesion();
  const [abierto, setAbierto] = useState<string | null>(null);
  if (!sesion) return null;

  const alternar = (clave: string) => setAbierto(abierto === clave ? null : clave);

  return (
    <Shell rol={sesion.rol} titulo="Información" subtitulo="Todo sobre la escuela">
      <Tarjeta>
        <div className="flex items-center gap-3">
          <ScrollText className="size-6 text-gold-brand" />
          <h2 className="text-xl font-bold">Contrato y Reglamento</h2>
        </div>
        <p className="mt-3 text-base text-muted-foreground">
          Revisa y firma el reglamento interno de la escuela.
        </p>
        <Button asChild variant="alerta" size="grande" className="mt-4">
          <Link to="/contrato">Ver Contrato</Link>
        </Button>
      </Tarjeta>

      <Tarjeta>
        <div className="flex items-center gap-3">
          <FileText className="size-6 text-cyan-brand" />
          <h2 className="text-xl font-bold">Reglamento</h2>
        </div>
        {abierto === "reglamento" ? (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base text-muted-foreground">
            <li>Llegar 15 minutos antes del entrenamiento.</li>
            <li>Traer bidón de agua, canilleras y zapatos de fútbol.</li>
            <li>Avisar la asistencia por la app antes de cada clase.</li>
            <li>La mensualidad es de $20.000 mensuales y vence el día 15 de cada mes.</li>
            <li>Respeto y buen trato con compañeros, profesores y árbitros.</li>
          </ul>
        ) : null}
        <Button
          variant="contorno"
          size="medio"
          className="mt-4 w-full"
          onClick={() => alternar("reglamento")}
        >
          {abierto === "reglamento" ? "Cerrar" : "Ver documento"}
        </Button>
      </Tarjeta>

      <Tarjeta>
        <div className="flex items-center gap-3">
          <Target className="size-6 text-gold-brand" />
          <h2 className="text-xl font-bold">Objetivo de la escuela</h2>
        </div>
        <p className="mt-3 text-base text-muted-foreground">
          Formar jugadores con valores: disciplina, respeto y trabajo en equipo.
          {abierto === "objetivo"
            ? " Cada niño y niña aprende fundamentos técnicos a su ritmo, en un ambiente sano y feliz, acompañado por profesores y una nutricionista que cuidan su desarrollo dentro y fuera de la cancha."
            : ""}
        </p>
        <Button
          variant="contorno"
          size="medio"
          className="mt-4 w-full"
          onClick={() => alternar("objetivo")}
        >
          {abierto === "objetivo" ? "Cerrar" : "Leer más"}
        </Button>
      </Tarjeta>

      <NuestrosProfesores />

      <Tarjeta>
        <div className="flex items-center gap-3">
          <Users className="size-6 text-cyan-brand" />
          <h2 className="text-xl font-bold">Horarios de clases</h2>
        </div>
        <ul className="mt-3 space-y-4">
          <li className="rounded-xl bg-secondary p-4">
            <p className="text-base font-bold">Carlos Martínez</p>
            <p className="text-base text-muted-foreground">
              Martes 19:00 a 20:00 hrs — 📍 Rancho Rossi Peñuelas
            </p>
          </li>
          <li className="rounded-xl bg-secondary p-4">
            <p className="text-base font-bold">Luis Fuentes</p>
            <p className="text-base text-muted-foreground">
              Jueves 19:00 a 20:00 hrs — 📍 Forza Club Simdempart
            </p>
          </li>
        </ul>
      </Tarjeta>

      <Tarjeta>
        <div className="flex items-center gap-3">
          <Images className="size-6 text-gold-brand" />
          <h2 className="text-xl font-bold">Fotos</h2>
        </div>
        <p className="mt-3 text-base text-muted-foreground">
          Las fotos de los partidos se comparten por WhatsApp con cada categoría.
        </p>
        <Button asChild variant="alerta" size="grande" className="mt-4">
          <a href="https://wa.me/56912345678" target="_blank" rel="noreferrer">
            Pedir fotos por WhatsApp
          </a>
        </Button>
      </Tarjeta>
    </Shell>
  );
}

function Contrato({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [aceptado, setAceptado] = useState(false);

  const { data: perfil } = useQuery({
    queryKey: ["contrato", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("contract_accepted_at")
        .eq("id", userId)
        .maybeSingle();
      return data ?? null;
    },
  });

  const firmar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ contract_accepted_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("¡Gracias! Tu contrato quedó vigente ✅");
      queryClient.invalidateQueries({ queryKey: ["contrato", userId] });
      queryClient.invalidateQueries({ queryKey: ["resumen-padre"] });
    },
    onError: () => toast.error("No pudimos guardar tu aceptación. Intenta otra vez."),
  });

  const vigente = Boolean(perfil?.contract_accepted_at);

  return (
    <Tarjeta destacada={!vigente}>
      <div className="flex items-center gap-3">
        <ScrollText className="size-6 text-gold-brand" />
        <h2 className="text-xl font-bold">Contrato y Reglamento</h2>
      </div>

      {vigente ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border-2 border-success bg-success/15 p-4">
          <CheckCircle2 className="size-7 shrink-0 text-success" />
          <p className="text-lg font-bold text-foreground">
            ✅ Contrato vigente — aceptado el{" "}
            {new Date(perfil!.contract_accepted_at as string).toLocaleDateString("es-CL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      ) : null}

      <div className="mt-4 max-h-[400px] space-y-3 overflow-y-auto rounded-xl border border-border bg-secondary p-4 text-base leading-relaxed text-foreground">
        {REGLAMENTO.map((bloque) => (
          <div key={bloque.titulo}>
            <p className="text-lg font-bold">{bloque.titulo}</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
              {bloque.puntos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {vigente ? null : (
        <>
          <label className="mt-5 flex items-start gap-4 rounded-xl bg-secondary p-4">
            <Checkbox
              checked={aceptado}
              onCheckedChange={(v) => setAceptado(v === true)}
              className="mt-1 size-8 border-2 border-cyan-brand"
            />
            <span className="text-base font-semibold leading-snug">
              He leído y acepto el reglamento interno y las normas de la escuela TIC TAC
            </span>
          </label>
          <Button
            variant="accion"
            size="gigante"
            className="mt-4"
            disabled={!aceptado || firmar.isPending}
            onClick={() => firmar.mutate()}
          >
            Firmar y Aceptar
          </Button>
        </>
      )}
    </Tarjeta>
  );
}

function NuestrosProfesores() {
  const { data: profesores } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const { data } = await supabase.from("coaches").select("*").order("created_at");
      return data ?? [];
    },
  });

  return (
    <Tarjeta>
      <div className="flex items-center gap-3">
        <Users className="size-6 text-cyan-brand" />
        <h2 className="text-xl font-bold">Nuestros Profesores</h2>
      </div>
      <ul className="mt-4 space-y-4">
        {(profesores ?? []).map((p) => (
          <li
            key={p.id}
            className="flex flex-col items-center rounded-2xl border border-border bg-secondary p-5 text-center"
          >
            {p.photo_url ? (
              <img
                src={p.photo_url}
                alt={`Foto de ${p.name}`}
                loading="lazy"
                className="size-24 rounded-full border-2 border-cyan-brand object-cover"
              />
            ) : (
              <div className="flex size-24 items-center justify-center rounded-full border-2 border-cyan-brand bg-card text-3xl font-black text-cyan-brand">
                {p.name.slice(0, 1)}
              </div>
            )}
            <p className="mt-3 text-xl font-bold">{p.name}</p>
            <p className="text-base font-semibold text-cyan-brand">{p.role}</p>
            {p.bio ? <p className="mt-2 text-base text-muted-foreground">{p.bio}</p> : null}
          </li>
        ))}
        {profesores && profesores.length === 0 ? (
          <li className="text-base text-muted-foreground">Aún no hay profesores publicados.</li>
        ) : null}
      </ul>
    </Tarjeta>
  );
}