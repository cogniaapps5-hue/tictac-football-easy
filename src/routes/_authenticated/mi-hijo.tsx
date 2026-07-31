import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Camera, Loader2, Phone, Save } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shell, Tarjeta, Estado } from "@/components/tictac/Shell";
import { useSesion, pesos, fechaCorta } from "@/lib/session";

export const Route = createFileRoute("/_authenticated/mi-hijo")({
  head: () => ({
    meta: [
      { title: "Mi Hijo — Escuela TIC TAC" },
      { name: "description", content: "Datos, asistencia y pagos de tu hijo en la escuela TIC TAC." },
      { property: "og:title", content: "Mi Hijo — Escuela TIC TAC" },
      { property: "og:description", content: "Datos, asistencia y pagos de tu hijo." },
    ],
  }),
  component: MiHijo,
});

function MiHijo() {
  const { data: sesion } = useSesion();
  const queryClient = useQueryClient();
  const archivoRef = useRef<HTMLInputElement>(null);
  const [editando, setEditando] = useState(false);
  const [contacto, setContacto] = useState({ nombre: "", telefono: "" });
  const [subiendo, setSubiendo] = useState(false);

  const { data } = useQuery({
    queryKey: ["mi-hijo", sesion?.userId],
    enabled: !!sesion,
    queryFn: async () => {
      const { data: alumnos } = await supabase
        .from("players")
        .select("*")
        .eq("parent_id", sesion!.userId)
        .order("name");
      const ids = (alumnos ?? []).map((a) => a.id);
      const [pagos, asistencia] = await Promise.all([
        ids.length
          ? supabase.from("payments").select("*").in("player_id", ids).order("due_date", { ascending: false })
          : Promise.resolve({ data: [] as never[] }),
        ids.length
          ? supabase
              .from("attendance")
              .select("*")
              .in("player_id", ids)
              .order("session_date", { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [] as never[] }),
      ]);
      return { alumnos: alumnos ?? [], pagos: pagos.data ?? [], asistencia: asistencia.data ?? [] };
    },
  });

  const guardarContacto = useMutation({
    mutationFn: async (playerId: string) => {
      const { error } = await supabase
        .from("players")
        .update({
          emergency_contact_name: contacto.nombre.trim().slice(0, 100),
          emergency_contact_phone: contacto.telefono.trim().slice(0, 30),
        })
        .eq("id", playerId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mi-hijo"] });
      setEditando(false);
      toast.success("Contacto actualizado");
    },
    onError: () => toast.error("No pudimos guardar el contacto"),
  });

  const alumno = data?.alumnos[0];
  const pendiente = data?.pagos.find((p) => p.status === "pending");

  async function subirComprobante(file: File) {
    if (!sesion || !pendiente) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("La foto es muy pesada (máximo 10 MB)");
      return;
    }
    setSubiendo(true);
    const ruta = `${sesion.userId}/${pendiente.id}-${Date.now()}`;
    const { error } = await supabase.storage.from("comprobantes").upload(ruta, file);
    if (!error) {
      const { error: err2 } = await supabase
        .from("payments")
        .update({ receipt_url: ruta })
        .eq("id", pendiente.id);
      if (err2) {
        setSubiendo(false);
        toast.error("No pudimos guardar el comprobante");
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["mi-hijo"] });
      queryClient.invalidateQueries({ queryKey: ["resumen-padre"] });
      toast.success("¡Comprobante enviado! La escuela lo revisará.");
    } else {
      toast.error("No pudimos subir la foto");
    }
    setSubiendo(false);
  }

  if (!sesion) return null;

  return (
    <Shell rol={sesion.rol} titulo="Mi Hijo" subtitulo={alumno?.name}>
      {!alumno ? (
        <Tarjeta>
          <p className="text-base">Aún no tienes alumnos asociados a tu cuenta.</p>
        </Tarjeta>
      ) : (
        <>
          <Tarjeta destacada>
            <p className="text-xl font-bold">👤 {alumno.name}</p>
            <p className="text-base text-muted-foreground">
              {alumno.schedule}
            </p>
            <p className="text-base text-muted-foreground">Profesor: {alumno.coach}</p>
          </Tarjeta>

          <Tarjeta>
            <div className="flex items-center gap-3">
              <Phone className="size-6 text-cyan-brand" />
              <h2 className="text-xl font-bold">Contacto de emergencia</h2>
            </div>
            {editando ? (
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-base">Nombre</Label>
                  <Input
                    value={contacto.nombre}
                    onChange={(e) => setContacto({ ...contacto, nombre: e.target.value })}
                    className="h-14 rounded-xl text-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-base">Teléfono</Label>
                  <Input
                    value={contacto.telefono}
                    onChange={(e) => setContacto({ ...contacto, telefono: e.target.value })}
                    className="h-14 rounded-xl text-lg"
                  />
                </div>
                <Button
                  variant="accion"
                  size="grande"
                  disabled={guardarContacto.isPending}
                  onClick={() => guardarContacto.mutate(alumno.id)}
                >
                  <Save /> Guardar
                </Button>
              </div>
            ) : (
              <>
                <p className="mt-2 text-lg">{alumno.emergency_contact_name ?? "Sin registrar"}</p>
                <p className="text-lg text-muted-foreground">{alumno.emergency_contact_phone ?? ""}</p>
                <Button
                  variant="contorno"
                  size="medio"
                  className="mt-4 w-full"
                  onClick={() => {
                    setContacto({
                      nombre: alumno.emergency_contact_name ?? "",
                      telefono: alumno.emergency_contact_phone ?? "",
                    });
                    setEditando(true);
                  }}
                >
                  Editar
                </Button>
              </>
            )}
          </Tarjeta>

          <Tarjeta>
            <h2 className="text-xl font-bold">📅 Asistencia</h2>
            <ul className="mt-3 space-y-2">
              {(data?.asistencia ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-xl bg-secondary p-3">
                  <span className="text-base">{fechaCorta(a.session_date)}</span>
                  <Estado estado={a.status} />
                </li>
              ))}
              {!data?.asistencia.length ? (
                <li className="text-base text-muted-foreground">Todavía sin registros.</li>
              ) : null}
            </ul>
          </Tarjeta>

          <Tarjeta destacada={!!pendiente}>
            <h2 className="text-xl font-bold">💳 Pagos</h2>
            <ul className="mt-3 space-y-2">
              {(data?.pagos ?? []).map((p) => (
                <li key={p.id} className="rounded-xl bg-secondary p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-base">
                      {p.concept} — {pesos(p.amount)}
                    </span>
                    <Estado estado={p.status} />
                  </div>
                  {p.status === "rejected" && p.rejection_reason ? (
                    <p className="mt-2 text-base text-danger">Motivo: {p.rejection_reason}</p>
                  ) : null}
                </li>
              ))}
            </ul>
            {pendiente ? (
              <>
                <input
                  ref={archivoRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void subirComprobante(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  variant="accion"
                  size="grande"
                  className="mt-4"
                  disabled={subiendo}
                  onClick={() => archivoRef.current?.click()}
                >
                  {subiendo ? <Loader2 className="animate-spin" /> : <Camera />}
                  Subir Comprobante
                </Button>
                {pendiente.receipt_url ? (
                  <p className="mt-3 text-base text-muted-foreground">
                    Ya enviaste una foto. La escuela la está revisando.
                  </p>
                ) : null}
              </>
            ) : null}
          </Tarjeta>
        </>
      )}
    </Shell>
  );
}