import { Button } from "@/components/ui/button";

/** Pantalla de carga a pantalla completa: evita el "negro" mientras llegan los datos. */
export function PantallaCargando({ texto = "Cargando…" }: { texto?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div
        className="size-12 animate-spin rounded-full border-4 border-secondary border-t-cyan-brand"
        aria-hidden="true"
      />
      <p className="text-lg font-bold text-muted-foreground">{texto}</p>
    </div>
  );
}

/** Mensaje de error visible con botón de reintento. Nunca dejar la pantalla en blanco. */
export function PantallaError({
  titulo = "No pudimos cargar la información",
  detalle,
  onReintentar,
}: {
  titulo?: string;
  detalle?: string;
  onReintentar?: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <span className="text-5xl" aria-hidden="true">
        ⚠️
      </span>
      <h2 className="text-2xl font-extrabold">{titulo}</h2>
      <p className="text-base text-muted-foreground">
        {detalle || "Revisa tu conexión a internet e intenta de nuevo."}
      </p>
      <Button
        variant="accion"
        size="grande"
        className="w-full"
        onClick={() => (onReintentar ? onReintentar() : window.location.reload())}
      >
        Reintentar
      </Button>
    </div>
  );
}

/** Estado vacío amable dentro de una pantalla. */
export function EstadoVacio({ emoji = "📭", texto }: { emoji?: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-secondary/40 p-6 text-center">
      <p className="text-4xl" aria-hidden="true">
        {emoji}
      </p>
      <p className="mt-2 text-lg font-semibold text-muted-foreground">{texto}</p>
    </div>
  );
}
