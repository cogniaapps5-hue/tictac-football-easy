import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { useSesion, pesos, fechaCorta } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/pagos")({
  head: () => ({
    meta: [
      { title: "Pagos — Escuela TIC TAC" },
      { name: "description", content: "Revisa y aprueba los comprobantes de pago de la escuela." },
      { property: "og:title", content: "Pagos — Escuela TIC TAC" },
      { property: "og:description", content: "Revisa y aprueba los comprobantes de pago." },
    ],
  }),
  component: Pagos,
});

type Filtro = "pending" | "approved" | "rejected";

function Pagos() {
  const { data: sesion } = useSesion();
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>("pending");
  const [foto, setFoto] = useState<string | null>(null);
  const [rechazo, setRechazo] = useState<{ id: string; nombre: string } | null>(null);
  const [motivo, setMotivo] = useState("");

  const { data: pagos } = useQuery({
    queryKey: ["pagos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*, players(name, category)")
        .order("created_at", { ascending: false });
      return data ?? [];
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

  async function verFoto(ruta: string) {
    const { data, error } = await supabase.storage.from("comprobantes").createSignedUrl(ruta, 600);
    if (error || !data) {
      toast.error("No pudimos abrir la foto");
      return;
    }
    setFoto(data.signedUrl);
  }

  if (!sesion) return null;
  if (sesion.rol !== "admin") {
    return (
      <Shell rol="parent" titulo="Pagos">
        <Tarjeta>
          <p className="text-base">Esta pantalla es solo para la administradora.</p>
        </Tarjeta>
      </Shell>
    );
  }

  const lista = (pagos ?? []).filter((p) => p.status === filtro);
  const pendientes = (pagos ?? []).filter((p) => p.status === "pending").length;

  return (
    <Shell rol="admin" titulo="Pagos" subtitulo="Revisa los comprobantes">
      <Tarjeta>
        <div className="flex gap-2">
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

      {filtro === "pending" ? (
        <Tarjeta destacada>
          <p className="text-3xl font-black text-primary">{pendientes}</p>
          <p className="text-lg font-semibold">
            {pendientes === 1 ? "pago pendiente por revisar" : "pagos pendientes por revisar"}
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
        <Tarjeta key={pago.id} destacada={pago.status === "pending"}>
          <div className="flex items-start gap-3">
            {pago.receipt_url && miniaturas?.[pago.receipt_url] ? (
              <button
                type="button"
                onClick={() => void verFoto(pago.receipt_url!)}
                className="shrink-0 overflow-hidden rounded-xl border-2 border-primary/50"
                aria-label={`Ver comprobante de ${pago.players?.name ?? "alumno"}`}
              >
                <img
                  src={miniaturas[pago.receipt_url]}
                  alt={`Comprobante de ${pago.players?.name ?? "alumno"}`}
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
            <div className="mt-4 space-y-3">
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
                  onClick={() => decidir.mutate({ id: pago.id, estado: "approved" })}
                >
                  <Check /> Aprobar
                </Button>
                <Button
                  variant="peligro"
                  size="medio"
                  className="h-auto min-h-[60px] flex-1 py-4 text-base"
                  onClick={() => {
                    setMotivo("");
                    setRechazo({ id: pago.id, nombre: pago.players?.name ?? "" });
                  }}
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