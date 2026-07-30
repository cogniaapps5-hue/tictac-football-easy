import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Target, Users, Images } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Shell, Tarjeta } from "@/components/tictac/Shell";
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
          <FileText className="size-6 text-cyan-brand" />
          <h2 className="text-xl font-bold">Reglamento</h2>
        </div>
        {abierto === "reglamento" ? (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-base text-muted-foreground">
            <li>Llegar 15 minutos antes del entrenamiento.</li>
            <li>Traer bidón de agua, canilleras y zapatos de fútbol.</li>
            <li>Avisar la asistencia por la app antes de cada clase.</li>
            <li>El pago de la mensualidad vence el día 15 de cada mes.</li>
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

      <Tarjeta>
        <div className="flex items-center gap-3">
          <Users className="size-6 text-cyan-brand" />
          <h2 className="text-xl font-bold">Profesores</h2>
        </div>
        <ul className="mt-3 space-y-3">
          <li className="rounded-xl bg-secondary p-4">
            <p className="text-base font-bold">Carlos Martínez</p>
            <p className="text-base text-muted-foreground">SUB12 — Miércoles 15:00</p>
          </li>
          <li className="rounded-xl bg-secondary p-4">
            <p className="text-base font-bold">Luis Fuentes</p>
            <p className="text-base text-muted-foreground">SUB15 — Viernes 17:00</p>
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