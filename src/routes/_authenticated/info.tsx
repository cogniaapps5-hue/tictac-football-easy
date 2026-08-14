import { createFileRoute } from "@tanstack/react-router";
import { exigirRol } from "@/lib/guard";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Target, Users, Images, Phone, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Shell, Tarjeta } from "@/components/tictac/Shell";
import { supabase } from "@/integrations/supabase/client";
import { useSesion } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/info")({
  beforeLoad: exigirRol("parent"),
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
          <Target className="size-6 text-gold-brand" />
          <h2 className="text-xl font-bold">Nuestra escuela</h2>
        </div>
        <p className="mt-3 text-lg font-bold italic text-gold-brand">
          “Todos jugamos, todos aprendemos y todos pertenecemos”
        </p>
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
          <Phone className="size-6 text-cyan-brand" />
          <h2 className="text-xl font-bold">Contacto</h2>
        </div>
        <ul className="mt-3 space-y-2 text-base text-muted-foreground">
          <li>✉️ Correo oficial: centrodeportivotictac@gmail.com</li>
          <li>👤 Director: Luis Felipe Guerrero Ossa</li>
          <li>💬 WhatsApp: grupo oficial de apoderados</li>
          <li>📸 Instagram: @tictac.siemprefeliz</li>
        </ul>
        <div className="mt-4 rounded-xl bg-secondary p-4 text-base">
          <p className="font-bold text-gold-brand">Datos para transferencia</p>
          <p className="mt-2 text-muted-foreground">Paola Monserrat Ugalde Rojo</p>
          <p className="text-muted-foreground">Banco Tenpo — Cuenta vista N° 11 11 1644 1964</p>
          <p className="text-muted-foreground">RUT: 16.441.964-9</p>
          <p className="text-muted-foreground">Correo: centrodeportivotictac@gmail.com</p>
        </div>
        <Button asChild variant="accion" size="grande" className="mt-4">
          <a href="mailto:centrodeportivotictac@gmail.com">Escribir un correo</a>
        </Button>
      </Tarjeta>

      <Tarjeta>
        <div className="flex items-center gap-3">
          <Users className="size-6 text-cyan-brand" />
          <h2 className="text-xl font-bold">Horarios de clases</h2>
        </div>
        <ul className="mt-3 space-y-4">
          <li className="rounded-xl bg-secondary p-4">
            <p className="text-base font-bold">Martes 19:00 a 20:00 hrs</p>
            <p className="text-base text-muted-foreground">
              📍 Forza Training Club — Las Azucenas #505, Sindempart, Coquimbo
            </p>
          </li>
          <li className="rounded-xl bg-secondary p-4">
            <p className="text-base font-bold">Jueves 19:00 a 20:00 hrs</p>
            <p className="text-base text-muted-foreground">
              📍 Rancho Rossi — Parcela 28, Vegas Sur Peñuelas, Coquimbo
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
          <a href="mailto:centrodeportivotictac@gmail.com?subject=Solicitud%20de%20fotos">
            Pedir fotos por correo
          </a>
        </Button>
      </Tarjeta>
    </Shell>
  );
}

const REGISTRO_CIVIL = "https://www.registrocivil.gob.cl";

function NuestrosProfesores() {
  const { data: profesores } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("coaches")
        .select("*")
        .order("sort_order")
        .order("created_at");
      return data ?? [];
    },
  });

  return (
    <Tarjeta className="p-6">
      <div className="flex items-center gap-3">
        <Users className="size-6 text-cyan-brand" />
        <h2 className="text-2xl font-bold">Cuerpo Técnico TIC TAC</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Profesionales certificados y verificados
      </p>

      <ul className="mt-6 grid gap-6 md:grid-cols-3">
        {(profesores ?? []).map((p) => {
          const esDirector = p.role === "director";
          const colorTexto = esDirector ? "text-gold-brand" : "text-cyan-brand";
          const colorBorde = esDirector ? "border-gold-brand" : "border-cyan-brand";
          const cargo = esDirector ? "Director Técnico" : "Staff Técnico";
          const insignia = esDirector
            ? `✅ Director Técnico - Título verificado ${etiquetaCasa(p.university)} ${p.graduation_year ?? ""} + Antecedentes limpios (11/08/2026)`
            : `✅ Título verificado ${etiquetaCasa(p.university)} ${p.graduation_year ?? ""} + Antecedentes limpios (11/08/2026)`;

          return (
            <li
              key={p.id}
              className="flex flex-col items-center rounded-2xl border border-border bg-secondary p-5 text-center shadow-lg"
            >
              <FotoProfesor
                url={p.photo_url}
                nombre={p.name}
                colorBorde={colorBorde}
                colorTexto={colorTexto}
              />

              <p className="mt-4 text-xl font-bold">{p.name}</p>
              <p className={`text-sm font-bold ${colorTexto}`}>{cargo}</p>
              <hr className={`my-3 w-full border-t-2 ${colorBorde}`} />

              <div className="space-y-1 text-[13px] text-muted-foreground">
                {p.title ? <p className="font-semibold text-foreground">{p.title}</p> : null}
                {p.university ? <p>{p.university}</p> : null}
                {p.graduation_year ? <p>Titulación: {p.graduation_year}</p> : null}
                {p.qualification ? <p>{p.qualification}</p> : null}
                {p.registry_number ? <p>Registro N° {p.registry_number}</p> : null}
                {p.rut ? <p>RUT: {p.rut}</p> : null}
                {p.certificate_folio ? (
                  <p>
                    Certificado de antecedentes: folio {p.certificate_folio} · emitido 11/08/2026 ·
                    SIN ANTECEDENTES
                  </p>
                ) : null}
              </div>

              <p className="mt-3 rounded-xl bg-[#10B981] px-3 py-2 text-xs font-semibold text-white">
                {insignia}
              </p>

              <a
                href={REGISTRO_CIVIL}
                target="_blank"
                rel="noreferrer"
                className="mt-3 text-sm font-semibold text-cyan-brand underline"
              >
                Verificar en Registro Civil
              </a>
            </li>
          );
        })}
        {profesores && profesores.length === 0 ? (
          <li className="text-base text-muted-foreground">Aún no hay profesores publicados.</li>
        ) : null}
      </ul>

      <div className="mt-6 rounded-2xl bg-[#0A2540] p-6">
        <ShieldCheck className="size-10 text-gold-brand" />
        <h3 className="mt-2 text-lg font-bold">Transparencia Total</h3>
        <p className="mt-2 text-base text-muted-foreground">
          Todos nuestros profesores cuentan con título profesional verificado y certificado de
          antecedentes para fines especiales, emitido el 11 de agosto de 2026. Puedes verificar la
          autenticidad de estos certificados en www.registrocivil.gob.cl usando los folios
          publicados.
        </p>
        <Button asChild variant="accion" size="grande" className="mt-4">
          <a href={REGISTRO_CIVIL} target="_blank" rel="noreferrer">
            Verificar en Registro Civil
          </a>
        </Button>
      </div>
    </Tarjeta>
  );
}

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function etiquetaCasa(universidad: string | null) {
  if (!universidad) return "";
  if (universidad.includes("Atacama")) return "UDA";
  if (universidad.includes("Pedro de Valdivia")) return "UPV";
  if (universidad.includes("Santo Tomás")) return "Santo Tomás";
  return universidad;
}
