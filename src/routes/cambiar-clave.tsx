import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
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
  const [clave, setClave] = useState("");
  const [repetir, setRepetir] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function guardar() {
    if (clave.length < 6) {
      toast.error("Tu nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (clave !== repetir) {
      toast.error("Las dos contraseñas no son iguales");
      return;
    }
    setCargando(true);
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
    toast.success("✅ Tu nueva contraseña quedó guardada");
    navigate({ to: "/inicio", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-10">
      <h1 className="text-center text-3xl font-extrabold">Crea tu contraseña personal</h1>
      <p className="mt-3 max-w-sm text-center text-lg text-muted-foreground">
        Entraste con la contraseña temporal (el RUT de tu hijo). Para seguir usando la app, crea tu
        propia clave.
      </p>

      <form
        className="mt-8 w-full max-w-sm space-y-5 rounded-2xl border-2 border-cyan-brand bg-card p-6 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
      >
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
          GUARDAR CONTRASEÑA
        </Button>
      </form>
    </div>
  );
}