import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, FileText, Loader2, RotateCcw, Send, X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MAXIMO_MB,
  TIPOS_ACEPTADOS,
  esImagen,
  esPdf,
  prepararArchivo,
  urlVistaPrevia,
} from "@/lib/comprobante";

/**
 * Botón + modal para que el apoderado envíe su comprobante de pago.
 * Acepta fotos (incluidas HEIC de iPhone) y PDF, muestra vista previa,
 * comprime la imagen a 800 px y avisa el avance de la subida.
 */
export function SubirComprobante({
  playerId,
  pagoId,
  userId,
  etiqueta = "Subir Comprobante",
  className,
  variante = "alerta",
}: {
  playerId: string;
  pagoId?: string | null;
  userId: string;
  etiqueta?: string;
  className?: string;
  variante?: "alerta" | "accion";
}) {
  const queryClient = useQueryClient();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<string | null>(null);
  const [progreso, setProgreso] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function elegir(file: File) {
    if (file.size > MAXIMO_MB * 1024 * 1024) {
      toast.error(`El archivo es muy pesado (máximo ${MAXIMO_MB} MB)`);
      return;
    }
    if (!esImagen(file) && !esPdf(file)) {
      toast.error("Solo puedes enviar una foto o un archivo PDF");
      return;
    }
    setError(null);
    setProgreso(0);
    setArchivo(file);
    setVista(urlVistaPrevia(file));
  }

  function cerrar() {
    if (vista) URL.revokeObjectURL(vista);
    setArchivo(null);
    setVista(null);
    setProgreso(0);
    setError(null);
  }

  const enviar = useMutation({
    mutationFn: async () => {
      if (!archivo) return;
      setError(null);
      setProgreso(15);
      const listo = await prepararArchivo(archivo);
      setProgreso(45);
      const ruta = `${userId}/${playerId}-${Date.now()}.${listo.extension}`;
      const { error: errSubida } = await supabase.storage
        .from("comprobantes")
        .upload(ruta, listo.blob, { contentType: listo.tipo, upsert: false });
      if (errSubida) throw new Error("No pudimos subir el archivo. Revisa tu conexión.");
      setProgreso(80);
      if (pagoId) {
        const { error: errPago } = await supabase
          .from("payments")
          .update({ receipt_url: ruta })
          .eq("id", pagoId);
        if (errPago) throw new Error("Subimos la foto pero no pudimos guardarla en tu pago.");
      } else {
        const hoy = new Date();
        const vence = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-06`;
        const { error: errNuevo } = await supabase.from("payments").insert({
          player_id: playerId,
          receipt_url: ruta,
          status: "pending",
          concept: "Mensualidad",
          due_date: vence,
        });
        if (errNuevo) throw new Error("Subimos la foto pero no pudimos registrar tu pago.");
      }
      setProgreso(100);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resumen-padre"] });
      queryClient.invalidateQueries({ queryKey: ["mi-hijo"] });
      queryClient.invalidateQueries({ queryKey: ["pagos"] });
      toast.success("¡Comprobante enviado! La escuela lo revisará. 🙏");
      cerrar();
    },
    onError: (e: unknown) => {
      setProgreso(0);
      setError(e instanceof Error ? e.message : "No pudimos enviar tu comprobante.");
    },
  });

  return (
    <>
      <input
        ref={entrada}
        type="file"
        accept={TIPOS_ACEPTADOS}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) elegir(file);
          e.target.value = "";
        }}
      />
      <Button
        variant={variante}
        size="grande"
        className={`h-auto min-h-[60px] w-full py-4 text-base ${className ?? ""}`}
        onClick={() => entrada.current?.click()}
      >
        <Camera /> {etiqueta}
      </Button>

      <Dialog open={Boolean(archivo)} onOpenChange={(v) => (v ? null : cerrar())}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Revisa tu comprobante</DialogTitle>
            <DialogDescription className="text-base">
              ¿Se ve bien? Si es así, envíalo a la escuela.
            </DialogDescription>
          </DialogHeader>

          {vista ? (
            <img
              src={vista}
              alt="Vista previa del comprobante"
              className="max-h-72 w-full rounded-xl object-contain"
            />
          ) : (
            <div className="flex items-center gap-3 rounded-xl bg-secondary p-4">
              <FileText className="size-8 text-cyan-brand" />
              <p className="text-base font-semibold">{archivo?.name}</p>
            </div>
          )}

          {enviar.isPending ? (
            <div className="space-y-2">
              <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-cyan-brand transition-all"
                  style={{ width: `${progreso}%` }}
                />
              </div>
              <p className="text-base font-semibold">
                {progreso < 45 ? "Optimizando tu foto..." : "Enviando a la escuela..."} {progreso}%
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="rounded-xl bg-black/70 p-4 text-base font-semibold text-white">
              ⚠️ {error} Puedes intentarlo otra vez.
            </p>
          ) : null}

          <Button
            variant="exito"
            size="grande"
            disabled={enviar.isPending}
            onClick={() => enviar.mutate()}
          >
            {enviar.isPending ? (
              <Loader2 className="animate-spin" />
            ) : error ? (
              <RotateCcw />
            ) : (
              <Send />
            )}
            {error ? "Reintentar envío" : "Enviar Comprobante"}
          </Button>
          <Button
            variant="neutro"
            size="medio"
            className="w-full"
            disabled={enviar.isPending}
            onClick={() => entrada.current?.click()}
          >
            <Camera /> Elegir otra foto
          </Button>
          <Button
            variant="neutro"
            size="medio"
            className="w-full"
            disabled={enviar.isPending}
            onClick={cerrar}
          >
            <X /> Cancelar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}