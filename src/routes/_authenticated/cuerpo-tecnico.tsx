import { PantallaCargando, PantallaError, EstadoVacio } from "@/components/tictac/Estados";
import { createFileRoute } from "@tanstack/react-router";
import { exigirRol } from "@/lib/guard";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Shell, Tarjeta } from "@/components/tictac/Shell";
import { supabase } from "@/integrations/supabase/client";
import { useSesion } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/cuerpo-tecnico")({
  beforeLoad: exigirRol("admin"),
  head: () => ({
    meta: [
      { title: "Cuerpo Técnico — Escuela TIC TAC" },
      { name: "description", content: "Gestiona los profesores y el cuerpo técnico de la escuela TIC TAC." },
      { property: "og:title", content: "Cuerpo Técnico — Escuela TIC TAC" },
      { property: "og:description", content: "Agrega y edita los profesores de la escuela." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CuerpoTecnico,
  errorComponent: ({ error }) => (
    <PantallaError detalle={error instanceof Error ? error.message : undefined} />
  ),
});

type Formulario = { id?: string; name: string; role: string; photo_url: string; bio: string };

const VACIO: Formulario = { name: "", role: "", photo_url: "", bio: "" };

function CuerpoTecnico() {
  const { data: sesion, isLoading: cargandoSesion, isError: errorSesion, refetch: recargarSesion } = useSesion();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Formulario | null>(null);

  const {
    data: profesores,
    isLoading: cargandoProfes,
    isError: falloProfes,
    refetch: recargarProfes,
  } = useQuery({
    queryKey: ["coaches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coaches").select("*").order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const guardar = useMutation({
    mutationFn: async (valor: Formulario) => {
      const fila = {
        name: valor.name.trim(),
        role: valor.role.trim() || "Profesor",
        photo_url: valor.photo_url.trim() || null,
        bio: valor.bio.trim(),
      };
      const { error } = valor.id
        ? await supabase.from("coaches").update(fila).eq("id", valor.id)
        : await supabase.from("coaches").insert(fila);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profesor guardado correctamente ✅");
      setForm(null);
      queryClient.invalidateQueries({ queryKey: ["coaches"] });
    },
    onError: () => toast.error("No pudimos guardar al profesor. Intenta otra vez."),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coaches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profesor eliminado");
      queryClient.invalidateQueries({ queryKey: ["coaches"] });
    },
    onError: () => toast.error("No pudimos eliminar al profesor."),
  });

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
      <Shell rol={sesion.rol} titulo="Cuerpo Técnico">
        <Tarjeta>
          <p className="text-lg font-semibold">Esta sección es solo para la administradora.</p>
        </Tarjeta>
      </Shell>
    );
  }

  return (
    <Shell rol="admin" titulo="Cuerpo Técnico" subtitulo="Profesores de la escuela">
      {form ? (
        <Tarjeta destacada>
          <h2 className="text-xl font-bold">{form.id ? "Editar profesor" : "Nuevo profesor"}</h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label htmlFor="nombre" className="text-base font-semibold">Nombre</Label>
              <Input
                id="nombre"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Carlos Martínez"
                className="mt-2 min-h-[60px] text-base"
              />
            </div>
            <div>
              <Label htmlFor="cargo" className="text-base font-semibold">Cargo</Label>
              <Input
                id="cargo"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                placeholder="Director Técnico"
                className="mt-2 min-h-[60px] text-base"
              />
            </div>
            <div>
              <Label htmlFor="foto" className="text-base font-semibold">URL de la foto</Label>
              <Input
                id="foto"
                value={form.photo_url}
                onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                placeholder="https://..."
                className="mt-2 min-h-[60px] text-base"
              />
            </div>
            <div>
              <Label htmlFor="bio" className="text-base font-semibold">Biografía</Label>
              <Textarea
                id="bio"
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={4}
                placeholder="Experiencia y certificaciones"
                className="mt-2 text-base"
              />
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-4">
            <Button
              variant="exito"
              size="grande"
              disabled={!form.name.trim() || guardar.isPending}
              onClick={() => guardar.mutate(form)}
            >
              Guardar profesor
            </Button>
            <Button variant="neutro" size="grande" onClick={() => setForm(null)}>
              Cancelar
            </Button>
          </div>
        </Tarjeta>
      ) : (
        <Button variant="alerta" size="gigante" onClick={() => setForm({ ...VACIO })}>
          <Plus /> Agregar profesor
        </Button>
      )}

      <Tarjeta>
        <div className="flex items-center gap-3">
          <Users className="size-6 text-cyan-brand" />
          <h2 className="text-xl font-bold">Profesores ({profesores?.length ?? 0})</h2>
        </div>
        <ul className="mt-4 space-y-4">
          {(profesores ?? []).map((p) => (
            <li key={p.id} className="rounded-2xl border border-border bg-secondary p-4">
              <div className="flex items-center gap-4">
                {p.photo_url ? (
                  <img
                    src={p.photo_url}
                    alt={`Foto de ${p.name}`}
                    loading="lazy"
                    className="size-16 rounded-full border-2 border-cyan-brand object-cover"
                  />
                ) : (
                  <div className="flex size-16 items-center justify-center rounded-full border-2 border-cyan-brand bg-card text-2xl font-black text-cyan-brand">
                    {p.name.slice(0, 1)}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-lg font-bold">{p.name}</p>
                  <p className="text-base font-semibold text-cyan-brand">{p.role}</p>
                </div>
              </div>
              {p.bio ? <p className="mt-3 text-base text-muted-foreground">{p.bio}</p> : null}
              <div className="mt-4 flex gap-4">
                <Button
                  variant="contorno"
                  size="medio"
                  className="flex-1"
                  onClick={() =>
                    setForm({
                      id: p.id,
                      name: p.name,
                      role: p.role,
                      photo_url: p.photo_url ?? "",
                      bio: p.bio ?? "",
                    })
                  }
                >
                  Editar
                </Button>
                <Button
                  variant="peligro"
                  size="medio"
                  className="flex-1"
                  disabled={eliminar.isPending}
                  onClick={() => eliminar.mutate(p.id)}
                >
                  <Trash2 /> Eliminar
                </Button>
              </div>
            </li>
          ))}
          {profesores && profesores.length === 0 ? (
            <li className="text-base text-muted-foreground">Aún no hay profesores cargados.</li>
          ) : null}
        </ul>
      </Tarjeta>
    </Shell>
  );
}