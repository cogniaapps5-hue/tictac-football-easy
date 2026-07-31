import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Send } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tarjeta } from "@/components/tictac/Shell";

type Recordatorio = {
  id: string;
  message: string;
  kind: string;
  players: { name: string } | null;
};

export function RecordatoriosAdmin() {
  const queryClient = useQueryClient();
  const [borradores, setBorradores] = useState<Record<string, string>>({});

  // Generación automática: se dispara al abrir el Inicio de la administradora.
  useQuery({
    queryKey: ["generar-recordatorios", new Date().toISOString().slice(0, 10)],
    staleTime: Infinity,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("generar_recordatorios_pago");
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["recordatorios-pendientes"] });
      return data ?? 0;
    },
  });

  const { data: pendientes } = useQuery({
    queryKey: ["recordatorios-pendientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_reminders")
        .select("id, message, kind, players(name)")
        .eq("status", "draft")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Recordatorio[];
    },
  });

  useEffect(() => {
    if (!pendientes) return;
    setBorradores((prev) => {
      const next = { ...prev };
      for (const r of pendientes) if (next[r.id] === undefined) next[r.id] = r.message;
      return next;
    });
  }, [pendientes]);

  const enviar = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const { error } = await supabase
          .from("payment_reminders")
          .update({
            message: borradores[id] ?? "",
            status: "sent",
            sent_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (error) throw error;
      }
      return ids.length;
    },
    onSuccess: (cantidad) => {
      queryClient.invalidateQueries({ queryKey: ["recordatorios-pendientes"] });
      toast.success(cantidad === 1 ? "Recordatorio enviado" : `${cantidad} recordatorios enviados`);
    },
    onError: () => toast.error("No pudimos enviar el recordatorio. Intenta otra vez."),
  });

  if (!pendientes?.length) {
    return (
      <Tarjeta>
        <div className="flex items-center gap-3">
          <BellRing className="size-7 text-gold-brand" />
          <h2 className="text-xl font-bold">Recordatorios pendientes de envío</h2>
        </div>
        <p className="mt-3 text-base text-muted-foreground">
          No hay recordatorios por enviar. Todo al día 🌟
        </p>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <div className="flex items-center gap-3">
        <BellRing className="size-7 text-gold-brand" />
        <h2 className="text-xl font-bold">Recordatorios pendientes de envío</h2>
      </div>
      <p className="mt-2 text-base text-muted-foreground">
        {pendientes.length} {pendientes.length === 1 ? "mensaje listo" : "mensajes listos"} para revisar
      </p>

      <Button
        variant="accion"
        size="grande"
        className="mt-4"
        disabled={enviar.isPending}
        onClick={() => enviar.mutate(pendientes.map((r) => r.id))}
      >
        <Send /> Enviar a Todos los Pendientes
      </Button>

      <ul className="mt-6 space-y-6">
        {pendientes.map((r) => (
          <li key={r.id} className="rounded-xl bg-secondary p-4">
            <p className="text-base font-bold">
              {r.players?.name ?? "Alumno"} ·{" "}
              {r.kind === "overdue" ? "Pago atrasado" : "Por vencer el día 6"}
            </p>
            <Textarea
              aria-label={`Mensaje para ${r.players?.name ?? "el apoderado"}`}
              className="mt-3 min-h-[180px] text-base"
              value={borradores[r.id] ?? r.message}
              onChange={(e) => setBorradores((prev) => ({ ...prev, [r.id]: e.target.value }))}
            />
            <Button
              variant="exito"
              size="grande"
              className="mt-4"
              disabled={enviar.isPending}
              onClick={() => enviar.mutate([r.id])}
            >
              <Send /> Enviar Ahora
            </Button>
          </li>
        ))}
      </ul>
    </Tarjeta>
  );
}