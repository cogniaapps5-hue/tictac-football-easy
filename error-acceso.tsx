import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/error-acceso")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sin acceso — Escuela TIC TAC" },
      {
        name: "description",
        content: "Tu cuenta todavía no tiene un perfil habilitado en la escuela de fútbol TIC TAC.",
      },
      { property: "og:title", content: "Sin acceso — Escuela TIC TAC" },
      {
        property: "og:description",
        content: "Tu cuenta todavía no tiene un perfil habilitado en la app TIC TAC.",
      },
    ],
  }),
  component: ErrorAcceso,
});

function ErrorAcceso() {
  const navigate = useNavigate();

  async function volver() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-10 text-center">
      <ShieldAlert className="size-16 text-danger" />
      <h1 className="text-3xl font-extrabold">Tu cuenta aún no está habilitada</h1>
      <p className="max-w-sm text-lg text-muted-foreground">
        Tu correo entró correctamente, pero todavía no tiene un perfil en la escuela. Escríbele a la
        administradora para activarlo.
      </p>
      <Button variant="accion" size="grande" className="max-w-sm" onClick={() => void volver()}>
        Volver al inicio de sesión
      </Button>
    </div>
  );
}
