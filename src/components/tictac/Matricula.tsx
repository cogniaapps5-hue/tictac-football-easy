import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Loader2, MessageCircle, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { edadDesde, grupoPorEdad } from "@/lib/carga-masiva-utils";
import { borrarBorrador, guardarBorrador, leerBorrador } from "@/lib/almacenamiento";
import {
  matricularAlumno,
  type EntradaMatricula,
  type ResultadoMatricula,
} from "@/lib/matricula.functions";

const TALLAS = ["S", "M", "L", "XL", "Otro"];
const GRUPOS = { iniciados: "Iniciados", intermedios: "Intermedios", avanzados: "Avanzados" };

const VACIO = {
  nombre_apoderado: "",
  rut_apoderado: "",
  email: "",
  telefono: "",
  nombre_alumno: "",
  rut_alumno: "",
  fecha_nacimiento: "",
  talla_polera: "M",
  condiciones_medicas: "",
  training_tuesday: true,
  training_thursday: false,
};

const BORRADOR = "tictac:matricula";

function Campo({
  etiqueta,
  error,
  children,
}: {
  etiqueta: string;
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-base">{etiqueta}</Label>
      {children}
      {error ? <p className="text-base font-semibold text-danger">Este dato es obligatorio</p> : null}
    </div>
  );
}

export function MatriculaManual() {
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ ...VACIO });
  const [tocado, setTocado] = useState(false);
  const [credenciales, setCredenciales] = useState<
    (ResultadoMatricula & { apoderado: string; alumno: string }) | null
  >(null);
  const enviar = useServerFn(matricularAlumno);

  // Borrador local: si la administradora recarga la página, no pierde lo escrito.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const guardado = leerBorrador<typeof VACIO>(BORRADOR);
    if (guardado) setForm({ ...VACIO, ...guardado });
  }, []);

  const sucio =
    abierto &&
    !credenciales &&
    (Object.keys(VACIO) as (keyof typeof VACIO)[]).some((k) => form[k] !== VACIO[k]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sucio) guardarBorrador(BORRADOR, form);
  }, [form, sucio]);

  useEffect(() => {
    if (typeof window === "undefined" || !sucio) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sucio]);

  const guardar = useMutation({
    mutationFn: async () => (await enviar({ data: form as EntradaMatricula })) as ResultadoMatricula,
    onSuccess: (r) => {
      setCredenciales({ ...r, apoderado: form.nombre_apoderado, alumno: form.nombre_alumno });
      queryClient.invalidateQueries();
      borrarBorrador(BORRADOR);
      toast.success("Alumno matriculado correctamente");
      setAbierto(false);
      setTocado(false);
      setForm({ ...VACIO });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "";
      toast.error(
        msg && msg.length < 120 ? msg : "No pudimos matricular al alumno. Intenta nuevamente.",
      );
    },
  });

  const faltan = {
    nombre_apoderado: !form.nombre_apoderado.trim(),
    rut_apoderado: !form.rut_apoderado.trim(),
    email: !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()),
    telefono: !form.telefono.trim(),
    nombre_alumno: !form.nombre_alumno.trim(),
    rut_alumno: form.rut_alumno.replace(/\D/g, "").length < 6,
    fecha_nacimiento: !form.fecha_nacimiento,
  };
  const hayErrores = Object.values(faltan).some(Boolean);

  const edad = form.fecha_nacimiento ? edadDesde(form.fecha_nacimiento) : null;

  function cerrar() {
    if (sucio && !window.confirm("¿Seguro que quieres salir? Perderás los datos no guardados")) return;
    setAbierto(false);
  }

  const mensajeWsp = credenciales
    ? `Hola ${credenciales.apoderado}, tu hijo ${credenciales.alumno} ha sido matriculado en Escuela TIC TAC. Usuario: ${credenciales.email}. Contraseña temporal: ${credenciales.clave}. Al entrar deberás crear tu propia clave.`
    : "";
  const textoCredenciales = credenciales
    ? `Usuario: ${credenciales.email}\nContraseña temporal: ${credenciales.clave}`
    : "";

  return (
    <>
      <Button
        variant="alerta"
        size="grande"
        className="min-h-[60px] py-4 text-lg"
        onClick={() => setAbierto(true)}
      >
        <UserPlus /> Matricular Nuevo Alumno
      </Button>

      <Dialog open={abierto} onOpenChange={(v) => (v ? setAbierto(true) : cerrar())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Matricular Nuevo Alumno</DialogTitle>
            <DialogDescription className="text-base">
              Creamos la cuenta del apoderado y matriculamos al alumno.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <p className="text-lg font-black text-cyan-brand">👤 Apoderado</p>
            <Campo etiqueta="Nombre del apoderado" error={tocado && faltan.nombre_apoderado}>
              <Input
                value={form.nombre_apoderado}
                onChange={(e) => setForm({ ...form, nombre_apoderado: e.target.value })}
                className={`h-14 rounded-xl text-lg ${tocado && faltan.nombre_apoderado ? "border-2 border-danger" : ""}`}
              />
            </Campo>
            <Campo etiqueta="RUT del apoderado (12345678-9)" error={tocado && faltan.rut_apoderado}>
              <Input
                value={form.rut_apoderado}
                onChange={(e) => setForm({ ...form, rut_apoderado: e.target.value })}
                className={`h-14 rounded-xl text-lg ${tocado && faltan.rut_apoderado ? "border-2 border-danger" : ""}`}
              />
            </Campo>
            <Campo etiqueta="Correo (será su usuario)" error={tocado && faltan.email}>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={`h-14 rounded-xl text-lg ${tocado && faltan.email ? "border-2 border-danger" : ""}`}
              />
            </Campo>
            <Campo etiqueta="Teléfono" error={tocado && faltan.telefono}>
              <Input
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                className={`h-14 rounded-xl text-lg ${tocado && faltan.telefono ? "border-2 border-danger" : ""}`}
              />
            </Campo>

            <p className="text-lg font-black text-cyan-brand">🧒 Alumno</p>
            <Campo etiqueta="Nombre del alumno" error={tocado && faltan.nombre_alumno}>
              <Input
                value={form.nombre_alumno}
                onChange={(e) => setForm({ ...form, nombre_alumno: e.target.value })}
                className={`h-14 rounded-xl text-lg ${tocado && faltan.nombre_alumno ? "border-2 border-danger" : ""}`}
              />
            </Campo>
            <div className="space-y-2">
              <Label className="text-base">RUT del alumno (12345678-9)</Label>
              <Input
                value={form.rut_alumno}
                onChange={(e) => setForm({ ...form, rut_alumno: e.target.value })}
                className={`h-14 rounded-xl text-lg ${tocado && faltan.rut_alumno ? "border-2 border-danger" : ""}`}
              />
              {tocado && faltan.rut_alumno ? (
                <p className="text-base font-semibold text-danger">
                  El RUT debe tener al menos 6 dígitos (será la clave temporal)
                </p>
              ) : (
                <p className="text-base text-muted-foreground">
                  Será la contraseña temporal: {form.rut_alumno.replace(/\D/g, "") || "—"}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label className="text-base">Fecha de nacimiento</Label>
              <Input
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={form.fecha_nacimiento}
                onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })}
                className={`h-14 rounded-xl text-lg ${tocado && faltan.fecha_nacimiento ? "border-2 border-danger" : ""}`}
              />
              {tocado && faltan.fecha_nacimiento ? (
                <p className="text-base font-semibold text-danger">Fecha de nacimiento obligatoria</p>
              ) : edad !== null ? (
                <p className="text-base text-muted-foreground">
                  {edad} años · Grupo {GRUPOS[grupoPorEdad(edad)]}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label className="text-base">Talla de polera</Label>
              <div className="flex flex-wrap gap-3">
                {TALLAS.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    variant={form.talla_polera === t ? "accion" : "neutro"}
                    size="medio"
                    onClick={() => setForm({ ...form, talla_polera: t })}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-base">Condiciones médicas (opcional)</Label>
              <Textarea
                value={form.condiciones_medicas}
                onChange={(e) => setForm({ ...form, condiciones_medicas: e.target.value })}
                className="min-h-[100px] rounded-xl text-lg"
              />
            </div>

            <p className="text-lg font-black text-cyan-brand">📅 Días de entrenamiento</p>
            <div className="flex gap-3">
              <Button
                type="button"
                variant={form.training_tuesday ? "accion" : "neutro"}
                size="medio"
                className="flex-1"
                aria-pressed={form.training_tuesday}
                onClick={() => setForm({ ...form, training_tuesday: !form.training_tuesday })}
              >
                {form.training_tuesday ? "✅" : "⬜"} Martes
              </Button>
              <Button
                type="button"
                variant={form.training_thursday ? "accion" : "neutro"}
                size="medio"
                className="flex-1"
                aria-pressed={form.training_thursday}
                onClick={() => setForm({ ...form, training_thursday: !form.training_thursday })}
              >
                {form.training_thursday ? "✅" : "⬜"} Jueves
              </Button>
            </div>

            <Button
              variant="alerta"
              size="grande"
              disabled={guardar.isPending}
              onClick={() => {
                setTocado(true);
                if (hayErrores) {
                  toast.error("Revisa los campos marcados en rojo");
                  return;
                }
                if (!form.training_tuesday && !form.training_thursday) {
                  toast.error("Elige al menos un día de entrenamiento");
                  return;
                }
                guardar.mutate();
              }}
            >
              {guardar.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />} Crear Cuenta y
              Matricular
            </Button>
            <Button variant="neutro" size="medio" className="w-full" onClick={cerrar}>
              <X /> Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(credenciales)} onOpenChange={() => setCredenciales(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">✅ Alumno matriculado correctamente</DialogTitle>
            <DialogDescription className="text-base">
              Entrega estas credenciales al apoderado.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border-2 border-gold-brand bg-black/70 p-4">
            <p className="text-lg font-semibold text-foreground">Usuario: {credenciales?.email}</p>
            <p className="text-lg font-semibold text-foreground">
              Contraseña temporal: {credenciales?.clave}
            </p>
          </div>
          <Button
            variant="alerta"
            size="grande"
            onClick={() => {
              void navigator.clipboard
                .writeText(textoCredenciales)
                .then(() => toast.success("Credenciales copiadas"))
                .catch(() => toast.error("No pudimos copiar las credenciales"));
            }}
          >
            <Copy /> Copiar Credenciales
          </Button>
          <Button
            variant="exito"
            size="grande"
            onClick={() =>
              window.open(`https://wa.me/?text=${encodeURIComponent(mensajeWsp)}`, "_blank")
            }
          >
            <MessageCircle /> Enviar por WhatsApp
          </Button>
          <Button variant="neutro" size="medio" className="w-full" onClick={() => setCredenciales(null)}>
            <X /> Cerrar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}