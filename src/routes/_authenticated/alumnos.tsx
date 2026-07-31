import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Search, UserPlus, Check, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shell, Tarjeta, Estado } from "@/components/tictac/Shell";
import { useSesion, proximoEntrenamiento } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/alumnos")({
  head: () => ({
    meta: [
      { title: "Alumnos — Escuela TIC TAC" },
      { name: "description", content: "Lista de alumnos y asistencia de la escuela TIC TAC." },
      { property: "og:title", content: "Alumnos — Escuela TIC TAC" },
      { property: "og:description", content: "Lista de alumnos y asistencia de la escuela TIC TAC." },
    ],
  }),
  component: Alumnos,
});

function semaforo(estado: string) {
  if (estado === "blocked") return "🔴 Bloqueado";
  if (estado === "pending_review") return "🟡 En revisión";
  if (estado === "exception") return "⚪ Excepción";
  return "🟢 Activo";
}

function Alumnos() {
  const { data: sesion } = useSesion();
  const queryClient = useQueryClient();
  const proximo = proximoEntrenamiento();
  const [busqueda, setBusqueda] = useState("");
  const [agregando, setAgregando] = useState(false);
  const [nuevo, setNuevo] = useState({ name: "", rut: "", category: "SUB12", parent_email: "" });

  const { data } = useQuery({
    queryKey: ["alumnos", proximo.iso],
    queryFn: async () => {
      const [alumnos, asistencia] = await Promise.all([
        supabase.from("players").select("*").order("name"),
        supabase.from("attendance").select("*").eq("session_date", proximo.iso),
      ]);
      return { alumnos: alumnos.data ?? [], asistencia: asistencia.data ?? [] };
    },
  });

  const marcar = useMutation({
    mutationFn: async ({ playerId, estado }: { playerId: string; estado: string }) => {
      const { error } = await supabase
        .from("attendance")
        .upsert(
          { player_id: playerId, session_date: proximo.iso, status: estado },
          { onConflict: "player_id,session_date" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alumnos"] });
      queryClient.invalidateQueries({ queryKey: ["resumen-admin"] });
      toast.success("Asistencia guardada");
    },
    onError: () => toast.error("No pudimos guardar la asistencia"),
  });

  const crear = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("players").insert({
        name: nuevo.name.trim(),
        rut: nuevo.rut.trim() || null,
        category: nuevo.category,
        parent_email: nuevo.parent_email.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alumnos"] });
      setNuevo({ name: "", rut: "", category: "SUB12", parent_email: "" });
      setAgregando(false);
      toast.success("Alumno agregado");
    },
    onError: () => toast.error("No pudimos agregar al alumno"),
  });

  const cambiarAcceso = useMutation({
    mutationFn: async ({ playerId, estado }: { playerId: string; estado: "exception" | "blocked" }) => {
      const { error } = await supabase.from("players").update({ access_status: estado }).eq("id", playerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alumnos"] });
      queryClient.invalidateQueries({ queryKey: ["resumen-admin"] });
      toast.success("Acceso actualizado");
    },
    onError: () => toast.error("No pudimos cambiar el acceso"),
  });

  if (!sesion) return null;
  if (sesion.rol !== "admin") {
    return (
      <Shell rol="parent" titulo="Alumnos">
        <Tarjeta>
          <p className="text-base">Esta pantalla es solo para la administradora.</p>
        </Tarjeta>
      </Shell>
    );
  }

  const texto = busqueda.trim().toLowerCase();
  const lista = (data?.alumnos ?? []).filter(
    (a) =>
      !texto ||
      a.name.toLowerCase().includes(texto) ||
      (a.rut ?? "").toLowerCase().includes(texto),
  );

  return (
    <Shell rol="admin" titulo="Alumnos" subtitulo={`${data?.alumnos.length ?? 0} inscritos`}>
      <Tarjeta>
        <Label htmlFor="buscar" className="text-base">
          Buscar alumno (nombre o RUT)
        </Label>
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-secondary px-4">
          <Search className="size-5 text-muted-foreground" />
          <Input
            id="buscar"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Escribe aquí..."
            className="h-14 border-0 bg-transparent text-lg focus-visible:ring-0"
          />
        </div>
      </Tarjeta>

      {lista.map((alumno) => {
        const marca = data?.asistencia.find((a) => a.player_id === alumno.id);
        return (
          <Tarjeta key={alumno.id}>
            <p className="text-xl font-bold">👤 {alumno.name}</p>
            <p className="text-base text-muted-foreground">
              {alumno.category} — {alumno.schedule}
            </p>
            {alumno.rut ? <p className="text-base text-muted-foreground">RUT {alumno.rut}</p> : null}
            <p className="mt-2 text-base font-semibold">{semaforo(alumno.access_status)}</p>
            <div className="mt-3">
              <Estado estado={marca?.status ?? "no_response"} />
            </div>
            {alumno.access_status === "blocked" || alumno.access_status === "exception" ? (
              <Button
                variant={alumno.access_status === "exception" ? "alerta" : "contorno"}
                size="medio"
                className="mt-3 h-auto min-h-[60px] w-full py-4 text-base"
                disabled={cambiarAcceso.isPending}
                onClick={() =>
                  cambiarAcceso.mutate({
                    playerId: alumno.id,
                    estado: alumno.access_status === "exception" ? "blocked" : "exception",
                  })
                }
              >
                {alumno.access_status === "exception"
                  ? "Quitar acceso excepcional"
                  : "Autorizar acceso excepcional"}
              </Button>
            ) : null}
            <div className="mt-4 flex gap-3">
              <Button
                variant="exito"
                size="medio"
                className="flex-1"
                onClick={() => marcar.mutate({ playerId: alumno.id, estado: "confirmed" })}
              >
                <Check /> Vino
              </Button>
              <Button
                variant="peligro"
                size="medio"
                className="flex-1"
                onClick={() => marcar.mutate({ playerId: alumno.id, estado: "absent" })}
              >
                <X /> Faltó
              </Button>
            </div>
          </Tarjeta>
        );
      })}

      {agregando ? (
        <Tarjeta destacada>
          <h2 className="text-xl font-bold">Nuevo alumno</h2>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-base">Nombre completo</Label>
              <Input
                value={nuevo.name}
                onChange={(e) => setNuevo({ ...nuevo, name: e.target.value })}
                className="h-14 rounded-xl text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">RUT</Label>
              <Input
                value={nuevo.rut}
                onChange={(e) => setNuevo({ ...nuevo, rut: e.target.value })}
                className="h-14 rounded-xl text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Correo del apoderado</Label>
              <Input
                type="email"
                value={nuevo.parent_email}
                onChange={(e) => setNuevo({ ...nuevo, parent_email: e.target.value })}
                className="h-14 rounded-xl text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Categoría</Label>
              <div className="flex gap-3">
                {["SUB12", "SUB15"].map((cat) => (
                  <Button
                    key={cat}
                    variant={nuevo.category === cat ? "accion" : "neutro"}
                    size="medio"
                    className="flex-1"
                    onClick={() => setNuevo({ ...nuevo, category: cat })}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              variant="accion"
              size="grande"
              disabled={!nuevo.name.trim() || crear.isPending}
              onClick={() => crear.mutate()}
            >
              Guardar Alumno
            </Button>
            <Button variant="neutro" size="medio" className="w-full" onClick={() => setAgregando(false)}>
              Cancelar
            </Button>
          </div>
        </Tarjeta>
      ) : (
        <Button variant="accion" size="grande" onClick={() => setAgregando(true)}>
          <UserPlus /> Agregar Alumno
        </Button>
      )}
    </Shell>
  );
}