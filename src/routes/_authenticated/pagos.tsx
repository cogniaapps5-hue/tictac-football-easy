import { createFileRoute } from "@tanstack/react-router";
import { exigirRol } from "@/lib/guard";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memo, useCallback, useState } from "react";
import { Check, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Shell, Tarjeta, Estado } from "@/components/tictac/Shell";
import { useSesion, pesos, fechaCorta, GRUPOS, grupoEtiqueta } from "@/lib/session";
import { PantallaCargando, PantallaError, EstadoVacio } from "@/components/tictac/Estados";

export const Route = createFileRoute("/_authenticated/pagos")({
  beforeLoad: exigirRol("admin"),
  head: () => ({
    meta: [
      { title: "Pagos — Escuela TIC TAC" },
      { name: "description", content: "Revisa y aprueba los comprobantes de pago de la escuela." },
      { property: "og:title", content: "Pagos — Escuela TIC TAC" },
      { property: "og:description", content: "Revisa y aprueba los comprobantes de pago." },
    ],
  }),
  component: Pagos,
  errorComponent: ({ error }) => (
    <PantallaError detalle={error instanceof Error ? error.message : undefined} />
  ),
});

type Filtro = "pending" | "approved" | "rejected";

type Pago = {
  id: string;
  status: string;
  amount: number;
  concept: string;
  due_date: string;
  receipt_url: string | null;
  rejection_reason: string | null;
  players: { name: string; age_group: string; access_status: string } | null;
};

/**
 * Fila de pago memoizada: al aprobar un pago solo se vuelve a dibujar la fila
 * afectada, así la lista responde al instante aunque haya muchos alumnos.
 */
const FilaPago = memo(function FilaPago({
  pago,
  miniatura,
  onVerFoto,
  onAprobar,
  onRechazar,
}: {
  pago: Pago;
  miniatura?: string;
  onVerFoto: (ruta: string) => void;
  onAprobar: (id: string) => void;
  onRechazar: (id: string, nombre: string) => void;
}) {
  return (
    <Tarjeta destacada={pago.status === "pending"}>
      <div className="flex items-start gap-3">
        {pago.receipt_url && miniatura ? (
          <button
            type="button"
            onClick={() => onVerFoto(pago.receipt_url!)}
            className="shrink-0 overflow-hidden rounded-xl border-2 border-primary/50"
            aria-label={`Ver comprobante de ${pago.players?.name ?? "alumno"}`}
          >
            <img
              src={miniatura}
              alt={`Comprobante de ${pago.players?.name ?? "alumno"}`}
              width={60}
              height={60}
              decoding="async"
              className="h-[60px] w-[60px] object-cover"
              loading="lazy"
            />
          </button>
        ) : (
          <div className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/40 text-muted-foreground">
            <ImageIcon />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <Estado estado={pago.status} />
          <p className="mt-2 text-xl font-bold">
            {pago.players?.name} — {pesos(pago.amount)}
          </p>
          <p className="text-base text-muted-foreground">
            {pago.concept} — vence {fechaCorta(pago.due_date)}
          </p>
        </div>
      </div>
      {pago.status === "pending" ? (
        <div className="mt-4 space-y-4">
          {pago.receipt_url ? null : (
            <p className="text-base text-muted-foreground">
              El apoderado todavía no sube la foto del comprobante.
            </p>
          )}
          <div className="flex gap-3">
            <Button
              variant="exito"
              size="medio"
              className="h-auto min-h-[60px] flex-1 py-4 text-base"
              onClick={() => onAprobar(pago.id)}
            >
              <Check /> Aprobar
            </Button>
            <Button
              variant="peligro"
              size="medio"
              className="h-auto min-h-[60px] flex-1 py-4 text-base"
              onClick={() => onRechazar(pago.id, pago.players?.name ?? "")}
            >
              <X /> Rechazar
            </Button>
          </div>
        </div>
      ) : null}
      {pago.status === "rejected" && pago.rejection_reason ? (
        <p className="mt-3 text-base text-danger">Motivo: {pago.rejection_reason}</p>
      ) : null}
    </Tarjeta>
  );
});

function Pagos() {
  const { data: sesion, isLoading: cargandoSesion, isError: errorSesion, refetch: recargarSesion } = useSesion();
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>("pending");
  const [grupo, setGrupo] = useState<string>("todos");
  const [foto, setFoto] = useState<string | null>(null);
  const [rechazo, setRechazo] = useState<{ id: string; nombre: string } | null>(null);
  const [motivo, setMotivo] = useState("");

  const { data: pagos } = useQuery({
    queryKey: ["pagos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select(
          "id, status, amount, concept, due_date, receipt_url, rejection_reason, players(name, age_group, access_status)",
        )
        .order("created_at", { ascending: false });
      return (data ?? []) as unknown as Pago[];
    },
  });

  const rutas = (pagos ?? []).map((p) => p.receipt_url).filter(Boolean) as string[];

  const { data: miniaturas } = useQuery({
    queryKey: ["comprobantes-urls", rutas.join(",")],
    enabled: rutas.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.storage.from("comprobantes").createSignedUrls(rutas, 600);
      const mapa: Record<string, string> = {};
      for (const item of data ?? []) {
        if (item.path && item.signedUrl) mapa[item.path] = item.signedUrl;
      }
      return mapa;
    },
  });

  const decidir = useMutation({
    mutationFn: async ({ id, estado, motivo }: { id: string; estado: string; motivo?: string }) => {
      const { error } = await supabase
        .from("payments")
        .update({ status: estado, rejection_reason: estado === "rejected" ? (motivo ?? null) : null })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ["pagos"] });
      const previo = queryClient.getQueryData<any[]>(["pagos"]);
      queryClient.setQueryData<any[]>(["pagos"], (actual) =>
        (actual ?? []).map((p) =>
          p.id === vars.id
            ? { ...p, status: vars.estado, rejection_reason: vars.motivo ?? null }
            : p,
        ),
      );
      return { previo };
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["pagos"] });
      queryClient.invalidateQueries({ queryKey: ["resumen-admin"] });
      setRechazo(null);
      setMotivo("");
      toast.success(vars.estado === "approved" ? "Pago aprobado" : "Pago rechazado");
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previo) queryClient.setQueryData(["pagos"], ctx.previo);
      toast.error("No pudimos guardar el cambio");
    },
  });

  const verFoto = useCallback(async (ruta: string) => {
    const { data, error } = await supabase.storage.from("comprobantes").createSignedUrl(ruta, 600);
    if (error || !data) {
      toast.error("No pudimos abrir la foto");
      return;
    }
    setFoto(data.signedUrl);
  }, []);

  const aprobar = useCallback(
    (id: string) => decidir.mutate({ id, estado: "approved" }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const pedirRechazo = useCallback((id: string, nombre: string) => {
    setMotivo("");
    setRechazo({ id, nombre });
  }, []);
  const abrirFoto = useCallback((ruta: string) => void verFoto(ruta), [verFoto]);

  if (cargandoSesion) return <PantallaCargando />;
  if (errorSesion || !sesion)
    return (
      <PantallaError
        titulo="No pudimos cargar tu sesión"
        onReintentar={() => void recargarSesion()}
      />
    );
  if (sesion.rol !== "admin") {
    return (
      <Shell rol="parent" titulo="Pagos">
        <Tarjeta>
          <p className="text-base">Esta pantalla es solo para la administradora.</p>
        </Tarjeta>
      </Shell>
    );
  }

  const porGrupo = (pagos ?? []).filter(
    (p) =>
      (grupo === "todos" || p.players?.age_group === grupo) &&
      // Los alumnos archivados salen de la bandeja activa; su historial sigue
      // disponible en el Reporte de Pagos.
      p.players?.access_status !== "inactive",
  );
  const lista = porGrupo.filter((p) => p.status === filtro);
  const pendientes = porGrupo.filter((p) => p.status === "pending").length;

  return (
    <Shell rol="admin" titulo="Pagos" subtitulo="Revisa los comprobantes">
      <Tarjeta>
        <div className="flex gap-4">
          {(
            [
              ["pending", `Pendientes (${pendientes})`],
              ["approved", "Aprobados"],
              ["rejected", "Rechazados"],
            ] as [Filtro, string][]
          ).map(([valor, texto]) => (
            <Button
              key={valor}
              variant={filtro === valor ? "accion" : "neutro"}
              size="medio"
              className="flex-1"
              onClick={() => setFiltro(valor)}
            >
              {texto}
            </Button>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta>
        <p className="text-base font-semibold">Grupo</p>
        <div className="mt-2 flex flex-wrap gap-4">
          {[{ valor: "todos", etiqueta: "Todos", emoji: "" }, ...GRUPOS].map((g) => (
            <Button
              key={g.valor}
              variant={grupo === g.valor ? "accion" : "neutro"}
              size="medio"
              className="h-auto min-h-[60px] flex-1 py-4 text-base"
              onClick={() => setGrupo(g.valor)}
            >
              {g.emoji} {g.etiqueta}
            </Button>
          ))}
        </div>
      </Tarjeta>

      {filtro === "pending" ? (
        <Tarjeta destacada>
          <p className="text-3xl font-black text-primary">{pendientes}</p>
          <p className="text-lg font-semibold">
            {pendientes === 1 ? "pago pendiente por revisar" : "pagos pendientes por revisar"}
          </p>
          <p className="mt-1 text-base text-muted-foreground">
            Pagos pendientes — {grupo === "todos" ? "Todos los grupos" : grupoEtiqueta(grupo)}
          </p>
        </Tarjeta>
      ) : null}

      {foto ? (
        <Tarjeta destacada>
          <img src={foto} alt="Comprobante de pago" className="w-full rounded-xl" />
          <Button variant="neutro" size="medio" className="mt-4 w-full" onClick={() => setFoto(null)}>
            Cerrar foto
          </Button>
        </Tarjeta>
      ) : null}

      {lista.map((pago) => (
        <FilaPago
          key={pago.id}
          pago={pago}
          miniatura={pago.receipt_url ? miniaturas?.[pago.receipt_url] : undefined}
          onVerFoto={abrirFoto}
          onAprobar={aprobar}
          onRechazar={pedirRechazo}
        />
      ))}

      {!lista.length ? (
        <Tarjeta>
          <p className="text-base text-muted-foreground">No hay pagos en esta lista.</p>
        </Tarjeta>
      ) : null}

      <Dialog open={!!rechazo} onOpenChange={(abierto) => !abierto && setRechazo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar pago</DialogTitle>
            <DialogDescription className="text-base">
              Indica el motivo del rechazo para que el apoderado pueda corregirlo
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={motivo}
            maxLength={300}
            rows={4}
            placeholder="Ej: la foto no se ve o el monto no coincide"
            className="text-base"
            onChange={(e) => setMotivo(e.target.value)}
          />
          <Button
            variant="peligro"
            size="medio"
            className="h-auto min-h-[60px] w-full py-4 text-base"
            disabled={!motivo.trim() || decidir.isPending}
            onClick={() =>
              rechazo &&
              decidir.mutate({ id: rechazo.id, estado: "rejected", motivo: motivo.trim() })
            }
          >
            Confirmar Rechazo
          </Button>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}