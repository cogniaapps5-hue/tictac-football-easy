import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Shell, Tarjeta } from "@/components/tictac/Shell";
import { useSesion, fechaCorta } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/avisos")({
  head: () => ({
    meta: [
      { title: "Avisos — Escuela TIC TAC" },
      { name: "description", content: "Envía avisos a los apoderados de la escuela TIC TAC." },
      { property: "og:title", content: "Avisos — Escuela TIC TAC" },
      { property: "og:description", content: "Envía avisos a los apoderados de la escuela." },
    ],
  }),
  component: Avisos,
});

function Avisos() {
  const { data: sesion } = useSesion();
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [destino, setDestino] = useState("all");

  const { data: avisos } = useQuery({
    queryKey: ["avisos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notices")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notices").insert({
        title: titulo.trim().slice(0, 100),
        content: mensaje.trim().slice(0, 1000),
        target_category: destino,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["avisos"] });
      setTitulo("");
      setMensaje("");
      toast.success("Aviso enviado");
    },
    onError: () => toast.error("No pudimos enviar el aviso"),
  });

  if (!sesion) return null;
  if (sesion.rol !== "admin") {
    return (
      <Shell rol="parent" titulo="Avisos">
        <Tarjeta>
          <p className="text-base">Esta pantalla es solo para la administradora.</p>
        </Tarjeta>
      </Shell>
    );
  }

  return (
    <Shell rol="admin" titulo="Avisos" subtitulo="Avisa a los apoderados">
      <Tarjeta destacada>
        <h2 className="text-xl font-bold">📢 Enviar aviso</h2>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-base">Título</Label>
            <Input
              value={titulo}
              maxLength={100}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Torneo del sábado"
              className="h-14 rounded-xl text-lg"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-base">Mensaje</Label>
            <Textarea
              value={mensaje}
              maxLength={1000}
              onChange={(e) => setMensaje(e.target.value)}
              placeholder="Cita 9:00 AM en la cancha 1..."
              className="min-h-32 rounded-xl text-lg"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-base">Para</Label>
            <div className="flex gap-2">
              {[
                ["all", "Todos"],
                ["SUB12", "SUB12"],
                ["SUB15", "SUB15"],
              ].map(([valor, texto]) => (
                <Button
                  key={valor}
                  variant={destino === valor ? "accion" : "neutro"}
                  size="medio"
                  className="flex-1"
                  onClick={() => setDestino(valor)}
                >
                  {texto}
                </Button>
              ))}
            </div>
          </div>
          <Button
            variant="accion"
            size="grande"
            disabled={!titulo.trim() || !mensaje.trim() || enviar.isPending}
            onClick={() => enviar.mutate()}
          >
            <Send /> ENVIAR AVISO
          </Button>
        </div>
      </Tarjeta>

      <Tarjeta>
        <h2 className="text-xl font-bold">Avisos enviados</h2>
        <ul className="mt-3 space-y-3">
          {(avisos ?? []).map((aviso) => (
            <li key={aviso.id} className="rounded-xl bg-secondary p-4">
              <p className="text-base font-bold">{aviso.title}</p>
              <p className="text-base text-muted-foreground">{aviso.content}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Para {aviso.target_category === "all" ? "todos" : aviso.target_category} ·{" "}
                {fechaCorta(aviso.created_at)}
              </p>
            </li>
          ))}
          {!avisos?.length ? (
            <li className="text-base text-muted-foreground">Todavía no envías avisos.</li>
          ) : null}
        </ul>
      </Tarjeta>
    </Shell>
  );
}