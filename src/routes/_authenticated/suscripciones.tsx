import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldAlert, Ban, CheckCircle2, CircleDollarSign } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Shell, Tarjeta } from "@/components/tictac/Shell";
import { PantallaCargando, PantallaError, EstadoVacio } from "@/components/tictac/Estados";
import { useSesion, pesos, fechaCorta } from "@/lib/session";
import { diasVencidos, esSuperAdmin, type Suscripcion } from "@/lib/suscripcion";

export const Route = createFileRoute("/_authenticated/suscripciones")({
  head: () => ({
    meta: [
      { title: "Suscripciones — Panel TIC TAC" },
      {
        name: "description",
        content: "Panel del dueño de la app: estado de pago y acceso de cada escuela suscrita.",
      },
      { property: "og:title", content: "Suscripciones — Panel TIC TAC" },
      {
        property: "og:description",
        content: "Suspende, reactiva y marca pagos de las escuelas suscritas a la app.",
      },
    ],
  }),
  component: Suscripciones,
  errorComponent: ({ error }) => (
    <PantallaError detalle={error instanceof Error ? error.message : undefined} />
  ),
});

const ESTADOS: Record<string, { texto: string; clase: string }> = {
  active: { texto: "Activa", clase: "bg-success text-success-foreground" },
  past_due: { texto: "Vencida", clase: "bg-gold-brand text-gold-brand-foreground" },
  suspended: { texto: "Suspendida", clase: "bg-danger text-danger-foreground" },
};

function mesSiguiente() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function Suscripciones() {
  const { data: sesion, isLoading, isError, refetch } = useSesion();
  if (isLoading) return <PantallaCargando />;
  if (isError || !sesion)
    return <PantallaError titulo="No pudimos cargar tu sesión" onReintentar={() => void refetch()} />;

  if (!esSuperAdmin(sesion.email)) {
    return (
      <Shell rol="admin" titulo="Sin acceso" subtitulo="Panel privado">
        <Tarjeta>
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <ShieldAlert className="size-14 text-danger" />
            <p className="text-lg font-bold">Este panel es solo para el dueño de la app.</p>
          </div>
        </Tarjeta>
      </Shell>
    );
  }

  return (
    <Shell rol="admin" titulo="Suscripciones" subtitulo="Panel del dueño de la app">
      <Panel />
    </Shell>
  );
}

function Panel() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["suscripciones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("id, school_id, school_name, status, monthly_amount, next_payment_date, last_payment_date")
        .order("school_name");
      if (error) throw error;
      return (data ?? []) as Suscripcion[];
    },
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, cambios }: { id: string; cambios: Record<string, string> }) => {
      const { error } = await supabase.from("subscriptions").update(cambios).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["suscripciones"] });
      toast.success("Suscripción actualizada");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar"),
  });

  if (isLoading) return <PantallaCargando texto="Cargando suscripciones…" />;
  if (isError)
    return <PantallaError titulo="No pudimos cargar las suscripciones" onReintentar={() => void refetch()} />;
  if (!data?.length)
    return <EstadoVacio titulo="Aún no hay escuelas suscritas" />;

  return (
    <>
      {data.map((s) => {
        const estado = ESTADOS[s.status] ?? ESTADOS.active;
        const vencidos = s.status === "active" ? 0 : diasVencidos(s.next_payment_date);
        const trabajando = actualizar.isPending;
        return (
          <Tarjeta key={s.id} destacada={s.status === "suspended"}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-xl font-bold">{s.school_name}</h2>
              <span className={`rounded-full px-4 py-1.5 text-base font-bold ${estado.clase}`}>
                {estado.texto}
              </span>
            </div>
            <dl className="mt-3 space-y-1 text-lg text-muted-foreground">
              <div>
                Mensualidad:{" "}
                <span className="font-bold text-foreground">{pesos(Number(s.monthly_amount))}</span>
              </div>
              <div>
                Próximo pago:{" "}
                <span className="font-bold text-foreground">{fechaCorta(s.next_payment_date)}</span>
              </div>
              <div>
                Último pago:{" "}
                <span className="font-bold text-foreground">
                  {s.last_payment_date ? fechaCorta(s.last_payment_date) : "Sin registro"}
                </span>
              </div>
              {diasVencidos(s.next_payment_date) > 0 ? (
                <div className="font-bold text-danger">
                  {diasVencidos(s.next_payment_date)} días vencidos
                </div>
              ) : null}
            </dl>

            <div className="mt-4 grid gap-3">
              <Button
                variant="neutro"
                size="medio"
                className="min-h-[60px]"
                disabled={trabajando || s.status === "suspended"}
                onClick={() =>
                  actualizar.mutate({ id: s.id, cambios: { status: "suspended" } })
                }
              >
                <Ban /> Suspender
              </Button>
              <Button
                variant="accion"
                size="medio"
                className="min-h-[60px]"
                disabled={trabajando || (s.status === "active" && vencidos === 0)}
                onClick={() =>
                  actualizar.mutate({
                    id: s.id,
                    cambios: { status: "active", next_payment_date: mesSiguiente() },
                  })
                }
              >
                <CheckCircle2 /> Reactivar
              </Button>
              <Button
                variant="neutro"
                size="medio"
                className="min-h-[60px]"
                disabled={trabajando}
                onClick={() =>
                  actualizar.mutate({
                    id: s.id,
                    cambios: {
                      status: "active",
                      last_payment_date: hoyISO(),
                      next_payment_date: mesSiguiente(),
                    },
                  })
                }
              >
                <CircleDollarSign /> Marcar como pagado
              </Button>
            </div>
          </Tarjeta>
        );
      })}
    </>
  );
}
