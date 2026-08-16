import { PantallaCargando, PantallaError, EstadoVacio } from "@/components/tictac/Estados";
import { createFileRoute } from "@tanstack/react-router";
import { exigirRol } from "@/lib/guard";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Phone, Save, HeartPulse } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shell, Tarjeta, Estado } from "@/components/tictac/Shell";
import { SubirComprobante } from "@/components/tictac/SubirComprobante";
import { useSesion, pesos, fechaCorta, grupoCorto } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/mi-hijo")({
  beforeLoad: exigirRol("parent"),
  head: () => ({
    meta: [
      { title: "Mi Hijo — Escuela TIC TAC" },
      {
        name: "description",
        content: "Ficha, pagos y asistencia de tu hijo en la escuela TIC TAC.",
      },
      { property: "og:title", content: "Mi Hijo — Escuela TIC TAC" },
      { property: "og:description", content: "Ficha, pagos y asistencia de tu hijo." },
    ],
  }),
  component: MiHijo,
  errorComponent: ({ error }) => (
    <PantallaError detalle={error instanceof Error ? error.message : undefined} />
  ),
});

function edadDe(fecha?: string | null) {
  if (!fecha) return null;
  const [a, m, d] = String(fecha).split("-").map(Number);
  const hoy = new Date();
  let edad = hoy.getFullYear() - a;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) edad -= 1;
  return edad;
}

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function MiHijo() {
  const { data: sesion, isLoading: cargandoSesion, isError: errorSesion, refetch: recargarSesion } = useSesion();
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState(false);
  const [contacto, setContacto] = useState({ nombre: "", telefono: "" });
  const [hijoId, setHijoId] = useState<string | null>(null);

  const {
    data,
    isLoading: cargandoDatos,
    isError: falloDatos,
    refetch: recargarDatos,
  } = useQuery({
    queryKey: ["mi-hijo", sesion?.userId],
    enabled: !!sesion,
    queryFn: async () => {
      const { data: alumnos, error: errorAlumnos } = await supabase
        .from("players")
        .select("*")
        .eq("parent_id", sesion!.userId)
        .order("name");
      const ids = (alumnos ?? []).map((a) => a.id);
      const [pagos, asistencia] = await Promise.all([
        ids.length
          ? supabase
              .from("payments")
              .select("*")
              .in("player_id", ids)
              .order("due_date", { ascending: false })
          : Promise.resolve({ data: [] as never[], error: null }),
        ids.length
          ? supabase
              .from("attendance")
              .select("*")
              .in("player_id", ids)
              .order("session_date", { ascending: false })
              .limit(20)
          : Promise.resolve({ data: [] as never[], error: null }),
      ]);
      if (errorAlumnos) throw errorAlumnos;
      if ("error" in pagos && pagos.error) throw pagos.error;
      if ("error" in asistencia && asistencia.error) throw asistencia.error;
      return { alumnos: alumnos ?? [], pagos: pagos.data ?? [], asistencia: asistencia.data ?? [] };
    },
  });

  const guardarContacto = useMutation({
    mutationFn: async (playerId: string) => {
      const { error } = await supabase
        .from("players")
        .update({
          emergency_contact_name: contacto.nombre.trim().slice(0, 100),
          emergency_contact_phone: contacto.telefono.trim().slice(0, 30),
        })
        .eq("id", playerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mi-hijo"] });
      setEditando(false);
      toast.success("Contacto actualizado");
    },
    onError: () => toast.error("No pudimos guardar el contacto"),
  });

  const hijos = data?.alumnos ?? [];
  const alumno = hijos.find((a) => a.id === hijoId) ?? hijos[0];
  const pagosAlumno = (data?.pagos ?? []).filter((p) => p.player_id === alumno?.id);
  const asistenciaAlumno = (data?.asistencia ?? []).filter((a) => a.player_id === alumno?.id);
  const pendiente = pagosAlumno.find((p) => p.status === "pending");
  const rechazado = pagosAlumno.find((p) => p.status === "rejected");
  const bloqueado = alumno?.access_status === "blocked";

  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().slice(0, 10);
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1).toISOString().slice(0, 10);
  const pagosMes = pagosAlumno.filter((p) => p.due_date >= inicioMes && p.due_date < finMes);
  const pagoAprobado = pagosMes.find((p) => p.status === "approved");
  const pagoEnRevision = pagosMes.find((p) => p.status === "pending" && p.receipt_url);
  const mesActual = MESES[hoy.getMonth()];

  const asistenciaMes = asistenciaAlumno.filter(
    (a) => a.session_date >= inicioMes && a.session_date < finMes,
  );
  const asistio = asistenciaMes.filter((a) => a.status === "confirmed").length;
  const porcentaje = asistenciaMes.length
    ? Math.round((asistio / asistenciaMes.length) * 100)
    : null;

  if (cargandoSesion) return <PantallaCargando />;
  if (errorSesion || !sesion)
    return (
      <PantallaError
        titulo="No pudimos cargar tu sesión"
        onReintentar={() => void recargarSesion()}
      />
    );

  return (
    <Shell rol={sesion.rol} titulo="Mi Hijo" subtitulo={alumno?.name}>
      {cargandoDatos ? <PantallaCargando texto="Cargando información…" /> : null}
      {falloDatos ? <PantallaError onReintentar={() => void recargarDatos()} /> : null}
      {!cargandoDatos && !falloDatos && !hijos.length ? (
        <EstadoVacio emoji="👦" texto="No hay alumnos asociados a tu cuenta. Escribe a la escuela." />
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

      {!alumno ? (
        <Tarjeta>
          <p className="text-base">Aún no tienes alumnos asociados a tu cuenta.</p>
        </Tarjeta>
      ) : (
        <>
          <Tarjeta destacada className="p-6">
            <p className="text-2xl font-black">👤 {alumno.name}</p>
            <ul className="mt-3 space-y-1 text-base text-muted-foreground">
              {edadDe(alumno.birth_date) !== null ? (
                <li>🎂 {edadDe(alumno.birth_date)} años</li>
              ) : null}
              <li>🏅 Categoría {grupoCorto(alumno.age_group)}</li>
              {alumno.jersey_size ? <li>👕 Talla polera: {alumno.jersey_size}</li> : null}
              <li>📅 {alumno.schedule}</li>
              <li>👨‍🏫 Profesor: {alumno.coach}</li>
            </ul>
            {alumno.medical_conditions ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl border-2 border-danger bg-danger/15 p-4">
                <HeartPulse className="mt-0.5 size-6 shrink-0 text-danger" />
                <p className="text-base font-bold text-danger">
                  Condiciones médicas: {alumno.medical_conditions}
                </p>
              </div>
            ) : null}
          </Tarjeta>

          <Tarjeta>
            <div className="flex items-center gap-3">
              <Phone className="size-6 text-cyan-brand" />
              <h2 className="text-xl font-bold">Contacto de emergencia</h2>
            </div>
              <h2 className="text-xl font-bold">Contacto de emergencia</h2>
            </div>
            {editando ? (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-base">Nombre</Label>
                  <Input
                    value={contacto.nombre}
                    onChange={(e) => setContacto({ ...contacto, nombre: e.target.value })}
                    className="h-14 rounded-xl text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-base">Teléfono</Label>
                  <Input
                    value={contacto.telefono}
                    onChange={(e) => setContacto({ ...contacto, telefono: e.target.value })}
                    className="h-14 rounded-xl text-lg"
                  />
                </div>
                <Button
                  variant="accion"
                  size="grande"
                  disabled={guardarContacto.isPending}
                  onClick={() => guardarContacto.mutate(alumno.id)}
                >
                  <Save /> Guardar
                </Button>
              </div>
            ) : (
              <>
                <p className="mt-2 text-lg">{alumno.emergency_contact_name ?? "Sin registrar"}</p>
                <p className="text-lg text-muted-foreground">
                  {alumno.emergency_contact_phone ?? ""}
                </p>
                <Button
                  variant="contorno"
                  size="medio"
                  className="mt-4 w-full"
                  onClick={() => {
                    setContacto({
                      nombre: alumno.emergency_contact_name ?? "",
                      telefono: alumno.emergency_contact_phone ?? "",
                    });
                    setEditando(true);
                  }}
                >
                  Editar
                </Button>
              </>
            )}
          </Tarjeta>

          <Tarjeta className="p-6">
            <h2 className="text-xl font-bold">💳 Pagos y Comprobantes</h2>

            {pagoAprobado ? (
              <div className="mt-4 rounded-xl border-2 border-success bg-success/15 p-4">
                <p className="text-lg font-bold text-success">✅ Pago de {mesActual} confirmado</p>
              </div>
            ) : pagoEnRevision ? (
              <div className="mt-4 rounded-xl border-2 border-gold-brand bg-gold-brand/20 p-4">
                <p className="text-lg font-bold">🕒 Comprobante en revisión</p>
                <p className="mt-1 text-base">Te avisaremos apenas lo confirmemos. ¡Gracias! 🙏</p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl bg-secondary p-4">
                <p className="text-lg font-bold">📋 Pago del mes pendiente</p>
                {pendiente ? (
                  <p className="mt-1 text-base text-muted-foreground">
                    {pendiente.concept}: {pesos(pendiente.amount)} — vence{" "}
                    {fechaCorta(pendiente.due_date)}
                  </p>
                ) : null}
              </div>
            )}

            {rechazado?.rejection_reason ? (
              <p className="mt-3 rounded-xl bg-black/70 p-4 text-lg font-semibold text-white">
                ⚠️ No pudimos confirmar tu último comprobante: {rechazado.rejection_reason}
              </p>
            ) : null}

            {bloqueado ? (
              <div className="mt-4 rounded-xl border-2 border-gold-brand bg-gold-brand/20 p-5">
                <p className="text-lg font-bold">
                  🌟 Hola, notamos que el pago de este mes está pendiente. Por favor sube tu
                  comprobante para que {alumno.name.split(" ")[0]} pueda seguir entrenando con
                  nosotros. ¡Te esperamos! 💙
                </p>
              </div>
            ) : null}

            <div className="mt-4">
              {pagoAprobado ? (
                <Button
                  disabled
                  size="grande"
                  className="h-auto min-h-[60px] w-full cursor-not-allowed bg-muted py-4 text-base text-muted-foreground hover:bg-muted"
                >
                  Pago confirmado
                </Button>
              ) : (
                <SubirComprobante
                  playerId={alumno.id}
                  pagoId={pendiente?.id ?? rechazado?.id ?? null}
                  userId={sesion.userId}
                  etiqueta={bloqueado ? "Subir Comprobante Ahora" : "📷 Subir Comprobante"}
                />
              )}
            </div>

            <h3 className="mt-6 text-lg font-bold">Historial de pagos</h3>
            <ul className="mt-3 space-y-2">
              {pagosAlumno.map((p) => (
                <li key={p.id} className="rounded-xl bg-secondary p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-base">
                      {MESES[Number(String(p.due_date).slice(5, 7)) - 1]} — {pesos(p.amount)}
                    </span>
                    <Estado estado={p.status} />
                  </div>
                </li>
              ))}
              {!pagosAlumno.length ? (
                <li className="text-base text-muted-foreground">Todavía sin pagos registrados.</li>
              ) : null}
            </ul>
          </Tarjeta>

          <Tarjeta className="p-6">
            <h2 className="text-xl font-bold">📅 Historial de Asistencia</h2>
            {porcentaje !== null ? (
              <p className="mt-2 text-lg font-bold text-cyan-brand">
                Asistencia de {mesActual}: {porcentaje}%
              </p>
            ) : null}
            <ul className="mt-3 space-y-2">
              {asistenciaAlumno.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between rounded-xl bg-secondary p-3"
                >
                  <span className="text-base">
                    {a.status === "confirmed" ? "✅" : a.status === "absent" ? "❌" : "•"}{" "}
                    {fechaCorta(a.session_date)}
                  </span>
                  <Estado estado={a.status} />
                </li>
              ))}
              {!asistenciaAlumno.length ? (
                <li className="text-base text-muted-foreground">Todavía sin registros.</li>
              ) : null}
            </ul>
          </Tarjeta>
        </>
      )}
    </Shell>
  );
}
