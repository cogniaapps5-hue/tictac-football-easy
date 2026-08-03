import { createFileRoute } from "@tanstack/react-router";
import { exigirRol } from "@/lib/guard";
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
import {
  useSesion,
  fechaCorta,
  GRUPOS,
  grupoEtiqueta,
  SEDES,
  sedeDe,
  CATEGORIAS_AVISO,
  categoriaAviso,
} from "@/lib/session";

function destinoEtiqueta(valor: string) {
  if (valor === "all") return "todos";
  if (SEDES.some((s) => s.valor === valor)) return `${sedeDe(valor).largo} · ${sedeDe(valor).sede}`;
  return grupoEtiqueta(valor);
}

export const Route = createFileRoute("/_authenticated/avisos")({
  beforeLoad: exigirRol("admin"),
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
  const [categoria, setCategoria] = useState("informacion_importante");

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
        category: categoria,
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
            <Label className="text-base">Tipo de aviso</Label>
            <div className="flex flex-wrap gap-4">
              {CATEGORIAS_AVISO.map((c) => (
                <Button
                  key={c.valor}
                  variant={categoria === c.valor ? "accion" : "neutro"}
                  size="medio"
                  className="h-auto min-h-[60px] flex-1 py-4 text-base"
                  onClick={() => setCategoria(c.valor)}
                >
                  {c.emoji} {c.etiqueta}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-base">Título</Label>
            <Input
              value={titulo}
              maxLength={100}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Partido amistoso del sábado"
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
            <div className="flex flex-wrap gap-4">
              {[
                ["all", "Todos"],
                ...GRUPOS.map((g) => [g.valor, `${g.emoji} ${g.etiqueta}`]),
              ].map(([valor, texto]) => (
                <Button
                  key={valor}
                  variant={destino === valor ? "accion" : "neutro"}
                  size="medio"
                  className="h-auto min-h-[60px] flex-1 py-4 text-base"
                  onClick={() => setDestino(valor)}
                >
                  {texto}
                </Button>
              ))}
            </div>
            <p className="pt-2 text-base font-semibold">O solo una sede</p>
            <div className="flex gap-4">
              {SEDES.map((s) => (
                <Button
                  key={s.valor}
                  variant={destino === s.valor ? "accion" : "neutro"}
                  size="medio"
                  className="h-auto min-h-[60px] flex-1 py-4 text-base"
                  onClick={() => setDestino(s.valor)}
                >
                  📍 {s.sede}
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
        <ul className="mt-3 space-y-4">
          {(avisos ?? []).map((aviso) => (
            <li key={aviso.id} className="rounded-xl bg-secondary p-4">
              <span
                className={`mb-2 inline-block rounded-full px-3 py-1 text-sm font-bold ${categoriaAviso(aviso.category).clase}`}
              >
                {categoriaAviso(aviso.category).emoji} {categoriaAviso(aviso.category).etiqueta}
              </span>
              <p className="text-base font-bold">{aviso.title}</p>
              <p className="text-base text-muted-foreground">{aviso.content}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Para {destinoEtiqueta(aviso.target_category)} ·{" "}
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