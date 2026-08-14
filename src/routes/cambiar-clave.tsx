import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/cambiar-clave")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Crear nueva contraseña — TIC TAC" },
      {
        name: "description",
        content: "Crea tu clave personal para entrar a la app de la escuela de fútbol TIC TAC.",
      },
      { property: "og:title", content: "Crear nueva contraseña — TIC TAC" },
      {
        property: "og:description",
        content: "Cambia tu contraseña temporal por una clave personal en la app TIC TAC.",
      },
    ],
  }),
  component: CambiarClave,
});

function CambiarClave() {
  const navigate = useNavigate();
  // Nunca es obligatorio: siempre se puede volver al inicio.
  const [obligatorio] = useState(false);
  const [correo, setCorreo] = useState("");
  const [actual, setActual] = useState("");
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) navigate({ to: "/", replace: true });
      else {
        setCorreo(data.user.email ?? "");
      }
    });
  }, [navigate]);

  async function guardar() {
    if (!obligatorio && actual.length < 1) {
      toast.error("Escribe tu contraseña actual");
      return;
    }
    if (clave.length < 6) {
      toast.error("Tu nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (clave !== repetir) {
      toast.error("Las dos contraseñas no son iguales");
      return;
    }
    setCargando(true);
    if (!obligatorio) {
      const { error: errorActual } = await supabase.auth.signInWithPassword({
        email: correo,
        password: actual,
      });
      if (errorActual) {
        setCargando(false);
        toast.error("Tu contraseña actual no es correcta");
        return;
      }
    }
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.auth.updateUser({ password: clave });
    if (error) {
      setCargando(false);
      toast.error("No pudimos guardar tu nueva contraseña. Intenta de nuevo.");
      return;
    }
    if (userData.user) {
      await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", userData.user.id);
    }
    setCargando(false);
    toast.success("Contraseña actualizada correctamente");
    navigate({ to: "/inicio", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <h1 className="text-center text-3xl font-extrabold">
        {obligatorio ? "Por seguridad, crea tu contraseña personal" : "Cambiar contraseña"}
      </h1>
      <p className="mt-3 max-w-sm text-center text-lg text-muted-foreground">
        {obligatorio
          ? "Entraste con la contraseña temporal (el RUT de tu hijo). Para seguir usando la app, crea tu propia clave."
          : "Escribe tu contraseña actual y luego la nueva clave que quieres usar."}
      </p>

      <form
        className="mt-8 w-full max-w-sm space-y-5 rounded-2xl border-2 border-cyan-brand bg-card p-6 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
        {!obligatorio ? (
          <div className="space-y-2">
            <Label htmlFor="actual" className="text-base">
              Contraseña actual
            </Label>
            <Input
              id="actual"
              type="password"
              autoComplete="current-password"
              value={actual}
              onChange={(e) => setActual(e.target.value)}
              className="h-14 rounded-xl text-lg"
            />
          </div>
        ) : null}
        <div className="space-y-2">
          <Label htmlFor="nueva" className="text-base">
            Nueva contraseña
          </Label>
          <Input
            id="nueva"
            type="password"
            autoComplete="new-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            className="h-14 rounded-xl text-lg"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="repetir" className="text-base">
            Repite la contraseña
          </Label>
          <Input
            id="repetir"
            type="password"
            autoComplete="new-password"
            value={repetir}
            onChange={(e) => setRepetir(e.target.value)}
            className="h-14 rounded-xl text-lg"
          />
        </div>
        <Button type="submit" variant="accion" size="grande" disabled={cargando}>
          {cargando ? <Loader2 className="animate-spin" /> : <KeyRound />}
          {obligatorio ? "GUARDAR NUEVA CONTRASEÑA" : "ACTUALIZAR CONTRASEÑA"}
        </Button>
      </form>

      {!obligatorio ? (
        <Button asChild variant="contorno" size="grande" className="mt-6 w-full max-w-sm">
          <Link to="/inicio">
            <Home />
            VOLVER AL INICIO
          </Link>
        </Button>
      ) : null}
    </div>
  );
}