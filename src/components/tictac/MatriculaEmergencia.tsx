import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Zap } from "lucide-react";

import { matriculaEmergencia } from "@/lib/matricula-emergencia.functions";
import type { ResultadoMatricula } from "@/lib/matricula.schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tarjeta } from "@/components/tictac/Shell";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const vacio = {
  nombre_apoderado: "",
  rut_apoderado: "",
  email: "",
  telefono: "",
  nombre_alumno: "",
  rut_alumno: "",
  fecha_nacimiento: "",
  talla_polera: "",
  condiciones_medicas: "",
  training_tuesday: true,
  training_thursday: false,
};

export function MatriculaEmergencia() {
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState(vacio);
  const [resultado, setResultado] = useState<ResultadoMatricula | null>(null);
  const queryClient = useQueryClient();
  const ejecutar = useServerFn(matriculaEmergencia);

  const mutacion = useMutation({
    mutationFn: () => ejecutar({ data: form }),
    onSuccess: (res) => {
      setResultado(res);
      setForm(vacio);
      queryClient.invalidateQueries({ queryKey: ["alumnos"] });
      queryClient.invalidateQueries({ queryKey: ["resumen-admin"] });
      toast.success("Alumno matriculado");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No pudimos matricular");
    },
  });

  const campo = (id: keyof typeof vacio, etiqueta: string, tipo = "text", placeholder = "") => (
    <div>
      <Label htmlFor={`em-${id}`} className="text-base">
        {etiqueta}
      </Label>
      <Input
        id={`em-${id}`}
        type={tipo}
        value={String(form[id])}
        placeholder={placeholder}
        className="mt-1 h-14 text-lg"
        onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))}
      />
    </div>
  );

  return (
    <Tarjeta className="border-[3px] border-danger/60">
      <h2 className="text-xl font-black">⚡ Matrícula Rápida (Emergencia)</h2>
      <p className="mt-1 text-base text-muted-foreground">
        Usa este botón si la matrícula normal falla.
      </p>
      <Button
        variant="peligro"
        size="grande"
        className="mt-3"
        onClick={() => {
          setResultado(null);
          setAbierto(true);
        }}
      >
        <Zap /> Matrícula Rápida (Emergencia)
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Matrícula Rápida</DialogTitle>
            <DialogDescription className="text-base">
              Completa los datos del apoderado y del alumno.
            </DialogDescription>
          </DialogHeader>

          {resultado ? (
            <div className="space-y-3 rounded-xl border-2 border-success bg-success/10 p-4">
              <p className="text-lg font-black">✅ Alumno matriculado</p>
              <p className="text-base">📧 Correo: {resultado.email}</p>
              {resultado.nuevoUsuario ? (
                <p className="text-base">🔑 Clave temporal: {resultado.clave}</p>
              ) : (
                <p className="text-base">El apoderado ya tenía cuenta (usa su clave actual).</p>
              )}
              {resultado.hermanos.length ? (
                <p className="text-base">👨‍👩‍👧 Hermanos: {resultado.hermanos.join(", ")}</p>
              ) : null}
              <Button variant="accion" size="medio" onClick={() => setAbierto(false)}>
                Cerrar
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {campo("nombre_apoderado", "Nombre del apoderado")}
              {campo("rut_apoderado", "RUT del apoderado", "text", "12.345.678-9")}
              {campo("email", "Correo del apoderado", "email")}
              {campo("telefono", "Teléfono", "tel", "+56 9 ...")}
              {campo("nombre_alumno", "Nombre del alumno")}
              {campo("rut_alumno", "RUT del alumno", "text", "25.123.456-7")}
              {campo("fecha_nacimiento", "Fecha de nacimiento", "date")}
              {campo("talla_polera", "Talla de polera (opcional)", "text", "S / M / L ...")}
              <div>
                <Label htmlFor="em-condiciones" className="text-base">
                  Condiciones médicas (opcional)
                </Label>
                <Input
                  id="em-condiciones"
                  value={form.condiciones_medicas}
                  className="mt-1 h-14 text-lg"
                  onChange={(e) => setForm((f) => ({ ...f, condiciones_medicas: e.target.value }))}
                />
              </div>
              <div>
                <p className="text-base font-semibold">Días de entrenamiento</p>
                <div className="mt-2 flex gap-3">
                  <Button
                    type="button"
                    variant={form.training_tuesday ? "accion" : "neutro"}
                    size="medio"
                    className="flex-1"
                    onClick={() =>
                      setForm((f) => ({ ...f, training_tuesday: !f.training_tuesday }))
                    }
                  >
                    Martes
                  </Button>
                  <Button
                    type="button"
                    variant={form.training_thursday ? "accion" : "neutro"}
                    size="medio"
                    className="flex-1"
                    onClick={() =>
                      setForm((f) => ({ ...f, training_thursday: !f.training_thursday }))
                    }
                  >
                    Jueves
                  </Button>
                </div>
              </div>
              <Button
                variant="peligro"
                size="grande"
                className="w-full"
                disabled={mutacion.isPending}
                onClick={() => mutacion.mutate()}
              >
                {mutacion.isPending ? "Matriculando…" : "Crear Cuenta y Matricular"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Tarjeta>
  );
}
