import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, X, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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

type Filtro = "all" | "pending" | "approved";

function Pagos() {
  const { data: sesion } = useSesion();
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<Filtro>("pending");
  const [foto, setFoto] = useState<string | null>(null);

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

  const decidir = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: string }) => {
      const { error } = await supabase.from("payments").update({ status: estado }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["pagos"] });
      queryClient.invalidateQueries({ queryKey: ["resumen-admin"] });
      toast.success(vars.estado === "approved" ? "Pago aprobado" : "Pago rechazado");
    },
    onError: () => toast.error("No pudimos guardar el cambio"),
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

  const lista = (pagos ?? []).filter((p) => filtro === "all" || p.status === filtro);

  return (
    <Shell rol="admin" titulo="Pagos" subtitulo="Revisa los comprobantes">
      <Tarjeta>
        <div className="flex gap-2">
          {(
            [
              ["pending", "Pendientes"],
              ["approved", "Aprobados"],
              ["all", "Todos"],
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
          <Estado estado={pago.status} />
          <p className="mt-2 text-xl font-bold">
            {pago.players?.name} — {pesos(pago.amount)}
          </p>
          <p className="text-base text-muted-foreground">
            {pago.concept} — vence {fechaCorta(pago.due_date)}
          </p>
          {pago.status === "pending" ? (
            <div className="mt-4 space-y-3">
              {pago.receipt_url ? (
                <Button
                  variant="contorno"
                  size="medio"
                  className="h-auto min-h-[60px] w-full py-4 text-base"
                  onClick={() => void verFoto(pago.receipt_url!)}
                >
                  <ImageIcon /> Ver Foto
                </Button>
              ) : (
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
                  onClick={() => decidir.mutate({ id: pago.id, estado: "rejected" })}
                >
                  <X /> Rechazar
                </Button>
              </div>
            </div>
          ) : null}
        </Tarjeta>
      ))}

      {!lista.length ? (
        <Tarjeta>
          <p className="text-base text-muted-foreground">No hay pagos en esta lista.</p>
        </Tarjeta>
      ) : null}
    </Shell>
  );
}