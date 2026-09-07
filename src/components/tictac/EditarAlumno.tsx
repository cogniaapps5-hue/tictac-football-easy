import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SelectorFecha } from "@/components/tictac/SelectorFecha";

const TALLAS = ["S", "M", "L", "XL", "Otro"];

export type AlumnoEditable = {
  id: string;
  name: string;
  rut: string | null;
  birth_date: string | null;
  jersey_size: string | null;
  medical_conditions: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_relationship: string | null;
  training_day: "martes" | "jueves";
};

/** Permite a la administradora corregir a mano los datos de una ficha
 *  (ortografía, fecha de nacimiento, talla, salud) sin recargar el Excel. */
export function EditarAlumno({ alumno }: { alumno: AlumnoEditable }) {
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({
    name: alumno.name,
    rut: alumno.rut ?? "",
    birth_date: alumno.birth_date ?? "",
    jersey_size: alumno.jersey_size ?? "",
    medical_conditions: alumno.medical_conditions ?? "",
    emergency_contact_name: alumno.emergency_contact_name ?? "",
    emergency_contact_phone: alumno.emergency_contact_phone ?? "",
    emergency_relationship: alumno.emergency_relationship ?? "",
    training_day: alumno.training_day,
  });

  const guardar = useMutation({
    mutationFn: async () => {
      const nombre = form.name.trim();
      if (!nombre) throw new Error("El nombre no puede quedar vacío");
      const anio = form.birth_date ? Number(form.birth_date.slice(0, 4)) : null;
      const { error } = await supabase
        .from("players")
        .update({
          name: nombre,
          rut: form.rut.trim() || null,
          birth_date: form.birth_date || null,
          ...(anio ? { birth_year: anio } : {}),
          jersey_size: form.jersey_size || null,
          medical_conditions: form.medical_conditions.trim() || null,
          emergency_contact_name: form.emergency_contact_name.trim() || null,
          emergency_contact_phone: form.emergency_contact_phone.trim() || null,
          emergency_relationship: form.emergency_relationship.trim() || null,
          training_day: form.training_day,
        })
        .eq("id", alumno.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alumnos"] });
      queryClient.invalidateQueries({ queryKey: ["resumen-admin"] });
      toast.success("Datos actualizados");
      setAbierto(false);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "No pudimos guardar los cambios"),
  });

  return (
    <>
      <Button
        variant="contorno"
        size="medio"
        className="mt-3 h-auto min-h-[60px] w-full py-4 text-base"
        onClick={() => setAbierto(true)}
      >
        <Pencil /> Editar datos
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Editar ficha</DialogTitle>
            <DialogDescription className="text-base">
              Corrige los datos del alumno y guarda.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-base">Nombre del alumno</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="h-14 rounded-xl text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">RUT</Label>
              <Input
                value={form.rut}
                onChange={(e) => setForm({ ...form, rut: e.target.value })}
                className="h-14 rounded-xl text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Fecha de nacimiento</Label>
              <SelectorFecha
                id={`nac-${alumno.id}`}
                valor={form.birth_date}
                onChange={(v) => setForm({ ...form, birth_date: v })}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Talla de polera</Label>
              <div className="flex flex-wrap gap-3">
                {TALLAS.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant={form.jersey_size === t ? "accion" : "neutro"}
                    size="medio"
                    onClick={() => setForm({ ...form, jersey_size: t })}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-base">Condiciones médicas</Label>
              <Textarea
                value={form.medical_conditions}
                onChange={(e) => setForm({ ...form, medical_conditions: e.target.value })}
                className="min-h-[100px] rounded-xl text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Contacto de emergencia</Label>
              <Input
                value={form.emergency_contact_name}
                onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })}
                placeholder="Nombre"
                className="h-14 rounded-xl text-lg"
              />
              <Input
                value={form.emergency_relationship}
                onChange={(e) => setForm({ ...form, emergency_relationship: e.target.value })}
                placeholder="Parentesco"
                className="h-14 rounded-xl text-lg"
              />
              <Input
                value={form.emergency_contact_phone}
                onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })}
                placeholder="Teléfono"
                className="h-14 rounded-xl text-lg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Día de entrenamiento</Label>
              <div className="flex gap-3">
                {(["martes", "jueves"] as const).map((d) => (
                  <Button
                    key={d}
                    type="button"
                    variant={form.training_day === d ? "accion" : "neutro"}
                    size="medio"
                    className="flex-1 capitalize"
                    onClick={() => setForm({ ...form, training_day: d })}
                  >
                    {d}
                  </Button>
                ))}
              </div>
            </div>

            <Button
              variant="alerta"
              size="grande"
              disabled={guardar.isPending}
              onClick={() => guardar.mutate()}
            >
              {guardar.isPending ? <Loader2 className="animate-spin" /> : <Save />}
              {guardar.isPending ? "Guardando..." : "Guardar cambios"}
            </Button>
            <Button
              variant="neutro"
              size="medio"
              className="w-full"
              onClick={() => setAbierto(false)}
            >
              <X /> Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
