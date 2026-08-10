import { createFileRoute } from "@tanstack/react-router";
import { exigirRol } from "@/lib/guard";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ScrollText, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Shell, Tarjeta } from "@/components/tictac/Shell";
import { supabase } from "@/integrations/supabase/client";
import { useSesion } from "@/lib/session";
import { CONTRATO_TIC_TAC } from "@/lib/contrato-tictac";

export const Route = createFileRoute("/_authenticated/contrato")({
  beforeLoad: exigirRol("parent"),
  head: () => ({
    meta: [
      { title: "Contrato y Reglamento — Escuela TIC TAC" },
      { name: "description", content: "Lee y firma el reglamento interno de la escuela de fútbol TIC TAC." },
      { property: "og:title", content: "Contrato y Reglamento — Escuela TIC TAC" },
      { property: "og:description", content: "Lee y firma el reglamento interno de la escuela TIC TAC." },
    ],
  }),
  component: ContratoPagina,
});

function ContratoPagina() {
  const { data: sesion } = useSesion();
  if (!sesion) return null;

  return (
    <Shell rol={sesion.rol} titulo="Contrato y Reglamento" subtitulo="Lee y firma el reglamento interno">
      <Contrato userId={sesion.userId} />
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
      toast.success("Contrato aceptado correctamente");
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
        <h2 className="text-xl font-bold">Contrato y Normas TIC TAC 2026</h2>
      </div>

      {vigente ? (
        <div className="mt-4 flex items-center gap-3 rounded-xl border-2 border-success bg-success/15 p-4">
          <CheckCircle2 className="size-8 shrink-0 text-success" />
          <p className="text-lg font-bold text-foreground">
            ✅ Contrato aceptado el{" "}
            {new Date(perfil!.contract_accepted_at as string).toLocaleDateString("es-CL", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      ) : null}

      <div className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto rounded-xl border border-border bg-secondary p-4 leading-relaxed text-foreground">
        {CONTRATO_TIC_TAC.map((bloque, i) =>
          bloque.t === "h" ? (
            <p key={i} className="pt-2 text-lg font-bold text-gold-brand">
              {bloque.x}
            </p>
          ) : (
            <p key={i} className="whitespace-pre-line text-base text-foreground/90">
              {bloque.x}
            </p>
          ),
        )}
      </div>

      {vigente ? (
        <Button variant="neutro" size="gigante" className="mt-5" disabled>
          Ya aceptaste el reglamento
        </Button>
      ) : (
        <>
          <label className="mt-5 flex items-start gap-4 rounded-xl bg-secondary p-4">
            <Checkbox
              checked={aceptado}
              onCheckedChange={(v) => setAceptado(v === true)}
              className="mt-1 size-8 border-2 border-cyan-brand"
            />
            <span className="text-lg font-semibold leading-snug">
              He leído y acepto el reglamento interno y las normas de la escuela TIC TAC
            </span>
          </label>
          <Button
            variant="alerta"
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
